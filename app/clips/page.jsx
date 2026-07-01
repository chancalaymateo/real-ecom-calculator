"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SCENES, SAMPLE_SCRIPT, SAMPLE_CLIPS, parseScript } from "./scenes.js";
import { uploadImage, generateAndWait } from "./api.js";
import "./clips.css";

const MODES = ["fun", "normal", "spicy"];
const RESOLUTIONS = ["480p", "720p"];
const ASPECTS = ["9:16", "16:9", "1:1", "2:3", "3:2"];

const STATE_LABEL = {
  idle: "Sin generar",
  processing: "Generando…",
  success: "Listo ✅",
  fail: "Error ❌",
};

let uid = 0;
const nextId = () => ++uid;

// Agrega los campos de estado que necesita cada escena en runtime.
function withRuntime(s, idx) {
  return {
    imageIndex: 0,
    duration: 9,
    ...s,
    id: s.id ?? idx + 1,
    title: s.title ?? `Escena ${idx + 1}`,
    status: "idle",
    taskId: null,
    rawState: "",
    videoUrls: [],
    error: "",
  };
}

export default function ClipsPage() {
  const [apiKey, setApiKey] = useState("");
  const [images, setImages] = useState([]); // {id, name, preview, url, uploading, error}
  const [settings, setSettings] = useState({
    mode: "normal",
    resolution: "720p",
    aspect_ratio: "9:16",
    nsfw_checker: true,
  });
  const [scenes, setScenes] = useState(() => SCENES.map(withRuntime));
  const [bulkText, setBulkText] = useState("");
  const [running, setRunning] = useState(false);
  const fileRef = useRef(null);

  // Cargar / guardar la API key en el navegador (sólo en cliente).
  useEffect(() => {
    const saved = localStorage.getItem("kie_api_key");
    if (saved) setApiKey(saved);
  }, []);
  useEffect(() => localStorage.setItem("kie_api_key", apiKey), [apiKey]);

  const readyImages = useMemo(() => images.filter((i) => i.url), [images]);

  function patchScene(id, patch) {
    setScenes((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }
  function patchImage(id, patch) {
    setImages((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }

  async function handleFiles(fileList) {
    if (!apiKey) {
      alert("Primero cargá tu API key de kie.ai arriba.");
      return;
    }
    const files = Array.from(fileList).slice(0, 3 - images.length);
    for (const file of files) {
      const id = nextId();
      const preview = URL.createObjectURL(file);
      setImages((prev) => [...prev, { id, name: file.name, preview, url: "", uploading: true, error: "" }]);
      try {
        const url = await uploadImage(file, apiKey);
        patchImage(id, { url, uploading: false });
      } catch (err) {
        patchImage(id, { uploading: false, error: String(err.message || err) });
      }
    }
    if (fileRef.current) fileRef.current.value = "";
  }

  function removeImage(id) {
    setImages((prev) => prev.filter((i) => i.id !== id));
    // reajustar indices de escenas si quedaron fuera de rango
    setScenes((prev) =>
      prev.map((s) => (s.imageIndex >= images.length - 1 ? { ...s, imageIndex: 0 } : s))
    );
  }

  function importScript() {
    const parsed = parseScript(bulkText);
    if (!parsed.length) {
      alert(
        'No pude reconocer ningún bloque.\nAsegurate de que cada uno empiece con algo tipo:\n"Escena 1 — Imagen 1 — 9 segundos"  o  "Clip — Imagen 1 — 8 segundos"'
      );
      return;
    }
    setScenes(parsed.map(withRuntime));
  }

  // Al pegar un guión, si tiene encabezados reconocibles lo separa solo.
  function handlePaste(e) {
    const pasted = e.clipboardData?.getData("text") || "";
    const parsed = parseScript(pasted);
    if (parsed.length) {
      e.preventDefault();
      setBulkText(pasted);
      setScenes(parsed.map(withRuntime));
    }
  }

  // Agregar una escena vacía a mano.
  function addScene() {
    setScenes((prev) => {
      const nextSceneId = prev.reduce((max, s) => Math.max(max, s.id || 0), 0) + 1;
      return [
        ...prev,
        {
          ...withRuntime({ prompt: "", duration: 9 }, prev.length),
          id: nextSceneId,
          title: `Escena ${prev.length + 1}`,
        },
      ];
    });
  }

  function removeScene(id) {
    setScenes((prev) => prev.filter((s) => s.id !== id));
  }

  async function runScene(scene) {
    const img = images[scene.imageIndex];
    if (!img || !img.url) {
      patchScene(scene.id, { status: "fail", error: "Esa imagen todavía no está subida." });
      return;
    }
    patchScene(scene.id, { status: "processing", error: "", videoUrls: [], taskId: null });
    try {
      const { taskId, videoUrls } = await generateAndWait(
        {
          imageUrl: img.url,
          prompt: scene.prompt,
          duration: scene.duration,
          mode: settings.mode,
          resolution: settings.resolution,
          aspect_ratio: settings.aspect_ratio,
          nsfw_checker: settings.nsfw_checker,
        },
        apiKey,
        {
          onUpdate: (u) =>
            patchScene(scene.id, { taskId: u.taskId, rawState: u.rawState || "" }),
        }
      );
      patchScene(scene.id, { status: "success", taskId, videoUrls });
    } catch (err) {
      patchScene(scene.id, { status: "fail", error: String(err.message || err) });
    }
  }

  function isSceneReady(s) {
    const img = images[s.imageIndex];
    return Boolean(img && img.url);
  }

  async function runAll() {
    if (!apiKey) return alert("Cargá tu API key primero.");
    if (!readyImages.length) return alert("Subí al menos una imagen.");

    const ready = scenes.filter(isSceneReady);
    const skipped = scenes.length - ready.length;
    if (!ready.length) return alert("Ninguna escena tiene su imagen subida todavía.");
    if (skipped > 0) {
      const ok = confirm(
        `${skipped} escena(s) apuntan a una imagen que no está subida y se van a saltear.\n¿Generar las ${ready.length} restantes?`
      );
      if (!ok) return;
    }

    setRunning(true);
    // Se lanzan en paralelo (cada una crea su tarea y hace polling).
    await Promise.allSettled(ready.map((s) => runScene(s)));
    setRunning(false);
  }

  const anyProcessing = scenes.some((s) => s.status === "processing");
  const missingCount = scenes.filter((s) => !isSceneReady(s)).length;

  return (
    <div className="clip-generator">
      <div className="app">
        <header>
          <Link href="/" className="back-link">
            <ArrowLeft size={15} /> Volver al portal
          </Link>
          <h1>🎬 Generador de Clips</h1>
          <p className="sub">
            Subí 1–3 imágenes, revisá los guiones y generá los clips con Kie.ai (grok-imagine).
          </p>
        </header>

        <section className="card">
          <label className="field">
            <span>API Key de kie.ai</span>
            <input
              type="password"
              placeholder="Bearer token (se guarda solo en tu navegador)"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
          </label>
        </section>

        <section className="card">
          <h2>1 · Pegá tu guión completo (opcional)</h2>
          <p className="hint" style={{ marginTop: 0, marginBottom: 10 }}>
            Pegá el guión y se separa <b>solo</b> en escenas. Cada bloque tiene que empezar con una
            línea tipo <b>Escena N — Imagen N — X segundos</b> (con voz) o{" "}
            <b>Clip — Imagen N — X segundos</b> (solo movimiento). También podés cargarlas a mano con
            el botón <b>+ Agregar escena</b> de abajo.
          </p>
          <textarea
            className="prompt"
            rows={7}
            placeholder={SAMPLE_SCRIPT}
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            onPaste={handlePaste}
          />
          <div className="row-between" style={{ marginTop: 10, marginBottom: 0 }}>
            <div className="run-all">
              <button className="btn" onClick={() => setBulkText(SAMPLE_SCRIPT)}>
                Ejemplo con voz
              </button>
              <button className="btn" onClick={() => setBulkText(SAMPLE_CLIPS)}>
                Ejemplo de clips
              </button>
            </div>
            <button className="btn primary" onClick={importScript}>
              ✂ Separar en bloques
            </button>
          </div>
        </section>

        <section className="card">
          <h2>2 · Imágenes de referencia ({images.length}/3)</h2>
          <div className="images">
            {images.map((img, idx) => (
              <div className="thumb" key={img.id}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.preview} alt={img.name} />
                <div className="thumb-tag">Imagen {idx + 1}</div>
                <button className="thumb-x" onClick={() => removeImage(img.id)} title="Quitar">
                  ✕
                </button>
                <div className={"thumb-state " + (img.error ? "err" : img.url ? "ok" : "load")}>
                  {img.uploading ? "Subiendo…" : img.error ? "Error" : "Subida ✓"}
                </div>
              </div>
            ))}
            {images.length < 3 && (
              <button className="thumb add" onClick={() => fileRef.current?.click()}>
                + Agregar
              </button>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            multiple
            hidden
            onChange={(e) => handleFiles(e.target.files)}
          />
          {images.some((i) => i.error) && (
            <p className="hint err">
              Alguna imagen no se pudo subir. Verificá tu API key y que pese menos de 10MB.
            </p>
          )}
        </section>

        <section className="card">
          <h2>3 · Ajustes globales</h2>
          <div className="settings">
            <Selector
              label="Modo"
              value={settings.mode}
              options={MODES}
              onChange={(mode) => setSettings((s) => ({ ...s, mode }))}
            />
            <Selector
              label="Resolución"
              value={settings.resolution}
              options={RESOLUTIONS}
              onChange={(resolution) => setSettings((s) => ({ ...s, resolution }))}
            />
            <Selector
              label="Aspect ratio"
              value={settings.aspect_ratio}
              options={ASPECTS}
              onChange={(aspect_ratio) => setSettings((s) => ({ ...s, aspect_ratio }))}
            />
            <label className="toggle">
              <input
                type="checkbox"
                checked={settings.nsfw_checker}
                onChange={(e) => setSettings((s) => ({ ...s, nsfw_checker: e.target.checked }))}
              />
              <span>nsfw_checker</span>
            </label>
          </div>
          <p className="hint">
            Con imágenes externas el modo <b>spicy</b> no está disponible y el aspect ratio suele
            ignorarse (el video toma las dimensiones de la imagen).
          </p>
        </section>

        <section className="card">
          <div className="row-between">
            <h2>4 · Escenas / Clips ({scenes.length})</h2>
            <div className="run-all">
              {missingCount > 0 && (
                <span className="warn-pill">⚠ {missingCount} sin imagen</span>
              )}
              <button className="btn" onClick={addScene}>+ Agregar escena</button>
              <button className="btn primary" disabled={running || anyProcessing} onClick={runAll}>
                {running || anyProcessing ? "Generando…" : "▶ Generar todos"}
              </button>
            </div>
          </div>

          <div className="scenes">
            {scenes.map((scene) => (
              <SceneCard
                key={scene.id}
                scene={scene}
                images={images}
                onChange={(patch) => patchScene(scene.id, patch)}
                onRun={() => runScene(scene)}
                onRemove={() => removeScene(scene.id)}
              />
            ))}
            {scenes.length === 0 && (
              <button className="btn" onClick={addScene} style={{ alignSelf: "flex-start" }}>
                + Agregar la primera escena
              </button>
            )}
          </div>
        </section>

        <footer>
          <p>
            Los videos quedan alojados por Kie. Descargalos antes de que expiren. Costo aprox: 27
            créditos por clip (según tu plan).
          </p>
        </footer>
      </div>
    </div>
  );
}

function Selector({ label, value, options, onChange }) {
  return (
    <div className="selector">
      <span>{label}</span>
      <div className="pills">
        {options.map((o) => (
          <button
            key={o}
            className={"pill " + (value === o ? "active" : "")}
            onClick={() => onChange(o)}
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}

function SceneCard({ scene, images, onChange, onRun, onRemove }) {
  const busy = scene.status === "processing";
  const img = images[scene.imageIndex];
  const imgReady = Boolean(img && img.url);
  const imgMsg = !img
    ? `Falta subir la Imagen ${scene.imageIndex + 1}`
    : img.uploading
    ? `La Imagen ${scene.imageIndex + 1} todavía se está subiendo…`
    : img.error
    ? `La Imagen ${scene.imageIndex + 1} falló al subir`
    : "";

  return (
    <div className={"scene " + scene.status + (imgReady ? "" : " missing-img")}>
      <div className="scene-head">
        <strong>{scene.title}</strong>
        <div className="scene-head-right">
          <span className={"badge " + scene.status}>{STATE_LABEL[scene.status]}</span>
          {onRemove && (
            <button
              className="scene-del"
              onClick={onRemove}
              disabled={busy}
              title="Borrar escena"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      <div className="scene-controls">
        <label>
          Duración (s)
          <input
            type="number"
            min={6}
            max={30}
            value={scene.duration}
            disabled={busy}
            onChange={(e) => onChange({ duration: Number(e.target.value) })}
          />
        </label>
        <label>
          Imagen
          <select
            className={imgReady ? "" : "input-err"}
            value={scene.imageIndex}
            disabled={busy}
            onChange={(e) => onChange({ imageIndex: Number(e.target.value) })}
          >
            {images.length === 0 && <option value={0}>—</option>}
            {images.map((im, idx) => (
              <option key={im.id} value={idx}>
                Imagen {idx + 1}
              </option>
            ))}
            {/* si la escena apunta a una imagen que no existe todavía */}
            {!img && <option value={scene.imageIndex}>Imagen {scene.imageIndex + 1} (falta)</option>}
          </select>
        </label>
        <button className="btn" disabled={busy || !imgReady} onClick={onRun} title={imgMsg}>
          {busy ? "…" : "Generar"}
        </button>
      </div>

      {!imgReady && <div className="scene-warn">⚠ {imgMsg}</div>}

      <textarea
        className="prompt"
        rows={5}
        value={scene.prompt}
        disabled={busy}
        onChange={(e) => onChange({ prompt: e.target.value })}
      />

      {scene.taskId && <div className="taskid">task: {scene.taskId} {scene.rawState && `(${scene.rawState})`}</div>}
      {scene.error && <div className="scene-err">{scene.error}</div>}

      {scene.videoUrls?.length > 0 && (
        <div className="results">
          {scene.videoUrls.map((u, i) => (
            <div key={i} className="result">
              <video src={u} controls preload="metadata" />
              <a href={u} target="_blank" rel="noreferrer" download>
                ⬇ Descargar clip
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
