"use client";
import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, RotateCcw, RefreshCw } from "lucide-react";
import { parseScript } from "./scenes.js";
import { uploadImage, generateAndWait, getCredits } from "./api.js";

const MODES = ["fun", "normal", "spicy"];
const RESOLUTIONS = ["480p", "720p"];
const ASPECTS = ["9:16", "16:9", "1:1", "2:3", "3:2"];

const STATE_LABEL = {
  idle: "Sin generar",
  processing: "Generando…",
  success: "Listo ✅",
  fail: "Error ❌",
};

const DEFAULT_SETTINGS = {
  mode: "normal",
  resolution: "720p",
  aspect_ratio: "9:16",
  nsfw_checker: true,
};

const STORAGE_KEY = "clips_state_v1";

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
    cost: null,
    error: "",
  };
}

export default function ClipsPage() {
  const [apiKey, setApiKey] = useState("");
  const [images, setImages] = useState([]); // {id, name, preview, url, uploading, error}
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [scenes, setScenes] = useState([]); // arranca vacío
  const [bulkText, setBulkText] = useState("");
  const [running, setRunning] = useState(false);
  const [balance, setBalance] = useState(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const fileRef = useRef(null);
  const balanceRef = useRef(null); // último balance conocido, para calcular costo
  const loaded = useRef(false);

  // ── Persistencia: cargar al montar ──
  useEffect(() => {
    try {
      const savedKey = localStorage.getItem("kie_api_key");
      if (savedKey) setApiKey(savedKey);
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const s = JSON.parse(raw);
        if (s.settings) setSettings({ ...DEFAULT_SETTINGS, ...s.settings });
        if (Array.isArray(s.scenes)) setScenes(s.scenes);
        if (Array.isArray(s.images)) {
          setImages(s.images.map((i) => ({ ...i, preview: i.url, uploading: false, error: "" })));
        }
      }
    } catch {}
    loaded.current = true;
  }, []);

  // ── Persistencia: guardar en cada cambio ──
  useEffect(() => {
    if (!loaded.current) return;
    try {
      const imagesToSave = images.filter((i) => i.url).map((i) => ({ id: i.id, name: i.name, url: i.url }));
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ settings, scenes, images: imagesToSave }));
    } catch {}
  }, [settings, scenes, images]);

  useEffect(() => localStorage.setItem("kie_api_key", apiKey), [apiKey]);

  // ── Balance ──
  async function refreshBalance() {
    if (!apiKey) {
      setBalance(null);
      balanceRef.current = null;
      return;
    }
    setBalanceLoading(true);
    try {
      const c = await getCredits(apiKey);
      setBalance(c);
      balanceRef.current = c;
    } catch {
      // dejamos el balance como estaba
    } finally {
      setBalanceLoading(false);
    }
  }
  // Refrescar el balance cuando hay/cambia la API key.
  useEffect(() => {
    if (apiKey) refreshBalance();
    else {
      setBalance(null);
      balanceRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey]);

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
  }

  function importScript() {
    const parsed = parseScript(bulkText);
    if (!parsed.length) {
      alert(
        'No pude reconocer ningún bloque.\nCada uno tiene que empezar con algo tipo:\n"Escena 1 — Imagen 1 — 9 segundos"  o  "Clip — Imagen 1 — 8 segundos"'
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

  function addScene() {
    setScenes((prev) => {
      const nextSceneId = prev.reduce((max, s) => Math.max(max, s.id || 0), 0) + 1;
      return [
        ...prev,
        { ...withRuntime({ prompt: "", duration: 9 }, prev.length), id: nextSceneId, title: `Escena ${prev.length + 1}` },
      ];
    });
  }

  function removeScene(id) {
    setScenes((prev) => prev.filter((s) => s.id !== id));
  }

  function resetAll() {
    if (!confirm("¿Restablecer todo? Se borran las escenas, las imágenes y el guión.")) return;
    setScenes([]);
    setImages([]);
    setBulkText("");
    setSettings(DEFAULT_SETTINGS);
  }

  async function runScene(scene) {
    const img = images[scene.imageIndex];
    if (!img || !img.url) {
      patchScene(scene.id, { status: "fail", error: "Esa imagen todavía no está subida." });
      return;
    }
    patchScene(scene.id, { status: "processing", error: "", videoUrls: [], taskId: null, cost: null });
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
        { onUpdate: (u) => patchScene(scene.id, { taskId: u.taskId, rawState: u.rawState || "" }) }
      );

      // Costo por video = diferencia de balance antes/después.
      let cost = null;
      try {
        const after = await getCredits(apiKey);
        if (balanceRef.current != null && after != null) cost = Math.max(0, Math.round(balanceRef.current - after));
        if (after != null) {
          balanceRef.current = after;
          setBalance(after);
        }
      } catch {}

      patchScene(scene.id, { status: "success", taskId, videoUrls, cost });
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
    if (!scenes.length) return alert("Agregá al menos una escena (pegá el guión o usá + Agregar escena).");
    if (!images.some((i) => i.url)) return alert("Subí al menos una imagen.");

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
    await Promise.allSettled(ready.map((s) => runScene(s)));
    setRunning(false);
  }

  const anyProcessing = scenes.some((s) => s.status === "processing");
  const missingCount = scenes.filter((s) => !isSceneReady(s)).length;

  return (
    <div className="clip-generator">
      <div className="app">
        <header className="clip-header">
          <div>
            <Link href="/" className="back-link">
              <ArrowLeft size={15} /> Volver al portal
            </Link>
            <h1>🎬 Generador de Clips</h1>
          </div>
          <div className="header-right">
            <div className="balance" title="Créditos disponibles en tu cuenta de Kie.ai">
              <span className="balance-label">Balance</span>
              <span className="balance-value">
                {balance != null ? `${balance.toLocaleString("es-AR")} créditos` : "—"}
              </span>
              <button
                className="icon-btn"
                onClick={refreshBalance}
                disabled={!apiKey || balanceLoading}
                title="Actualizar balance"
              >
                <RefreshCw size={14} className={balanceLoading ? "spin" : ""} />
              </button>
            </div>
            <button className="btn" onClick={resetAll}>
              <RotateCcw size={14} /> Restablecer todo
            </button>
          </div>
        </header>

        {/* Ajustes globales (compactos, arriba de todo) */}
        <section className="card settings-bar">
          <label className="sfield grow">
            <span>API Key de kie.ai</span>
            <input
              type="password"
              placeholder="Bearer token (se guarda en tu navegador)"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
          </label>
          <label className="sfield">
            <span>Modo</span>
            <select value={settings.mode} onChange={(e) => setSettings((s) => ({ ...s, mode: e.target.value }))}>
              {MODES.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </label>
          <label className="sfield">
            <span>Resolución</span>
            <select value={settings.resolution} onChange={(e) => setSettings((s) => ({ ...s, resolution: e.target.value }))}>
              {RESOLUTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </label>
          <label className="sfield">
            <span>Aspecto</span>
            <select value={settings.aspect_ratio} onChange={(e) => setSettings((s) => ({ ...s, aspect_ratio: e.target.value }))}>
              {ASPECTS.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </label>
          <label className="toggle">
            <input
              type="checkbox"
              checked={settings.nsfw_checker}
              onChange={(e) => setSettings((s) => ({ ...s, nsfw_checker: e.target.checked }))}
            />
            <span>nsfw</span>
          </label>
        </section>

        {/* Guión */}
        <section className="card">
          <h2>Guión</h2>
          <textarea
            className="prompt"
            rows={6}
            placeholder="Pegá tu guión acá…"
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            onPaste={handlePaste}
          />
          <div className="row-between" style={{ marginTop: 10, marginBottom: 0, justifyContent: "flex-end" }}>
            <button className="btn primary" onClick={importScript}>
              ✂ Separar
            </button>
          </div>
        </section>

        {/* Imágenes */}
        <section className="card">
          <h2>Imágenes ({images.length}/3)</h2>
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

        {/* Escenas / Clips */}
        <section className="card">
          <div className="row-between">
            <h2>Escenas / Clips ({scenes.length})</h2>
            <div className="run-all">
              {missingCount > 0 && <span className="warn-pill">⚠ {missingCount} sin imagen</span>}
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
          {scene.cost != null && <span className="cost-pill">−{scene.cost} créditos</span>}
          <span className={"badge " + scene.status}>{STATE_LABEL[scene.status]}</span>
          {onRemove && (
            <button className="scene-del" onClick={onRemove} disabled={busy} title="Borrar escena">
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

      {scene.taskId && (
        <div className="taskid">task: {scene.taskId} {scene.rawState && `(${scene.rawState})`}</div>
      )}
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
