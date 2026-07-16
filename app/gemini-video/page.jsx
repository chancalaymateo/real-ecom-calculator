"use client";
import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Download, RotateCcw, RefreshCw, Plus, X, Film } from "lucide-react";
import { uploadFile, generateAndWait, getCredits } from "./api.js";
import "./gemini.css";

const DURATIONS = ["4", "6", "8", "10"];
const ASPECTS = ["16:9", "9:16"];
const RESOLUTIONS = ["720p", "1080p", "4k"];
const MAX_IMAGES = 7;
const MAX_AUDIO = 3;
const MAX_CHARS = 3;

const DEFAULT_SETTINGS = {
  duration: "8",
  aspect_ratio: "16:9",
  resolution: "720p",
  seed: "",
};

const STORAGE_KEY = "gemini_video_state_v1";

let uid = 0;
const nextId = () => ++uid;

export default function GeminiVideoPage() {
  const [apiKey, setApiKey] = useState("");
  const [prompt, setPrompt] = useState("");
  const [images, setImages] = useState([]); // {id, name, preview, url, uploading, error}
  const [video, setVideo] = useState(null); // {name, url, uploading, error, start, ends}
  const [audioIds, setAudioIds] = useState([]);
  const [characterIds, setCharacterIds] = useState([]);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);

  const [status, setStatus] = useState("idle"); // idle | processing | success | fail
  const [taskId, setTaskId] = useState(null);
  const [rawState, setRawState] = useState("");
  const [videoUrls, setVideoUrls] = useState([]);
  const [error, setError] = useState("");
  const [cost, setCost] = useState(null);

  const [balance, setBalance] = useState(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [fileDropActive, setFileDropActive] = useState(false);

  const imgRef = useRef(null);
  const videoRef = useRef(null);
  const balanceRef = useRef(null);
  const loaded = useRef(false);

  // ── Persistencia ──
  useEffect(() => {
    try {
      const savedKey = localStorage.getItem("kie_api_key");
      if (savedKey) setApiKey(savedKey);
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const s = JSON.parse(raw);
        if (typeof s.prompt === "string") setPrompt(s.prompt);
        if (s.settings) setSettings({ ...DEFAULT_SETTINGS, ...s.settings });
        if (Array.isArray(s.images))
          setImages(s.images.map((i) => ({ ...i, preview: i.url, uploading: false, error: "" })));
        if (s.video) setVideo({ ...s.video, preview: s.video.url, uploading: false, error: "" });
        if (Array.isArray(s.audioIds)) setAudioIds(s.audioIds);
        if (Array.isArray(s.characterIds)) setCharacterIds(s.characterIds);
      }
    } catch {}
    loaded.current = true;
  }, []);

  useEffect(() => {
    if (!loaded.current) return;
    try {
      const imagesToSave = images.filter((i) => i.url).map((i) => ({ id: i.id, name: i.name, url: i.url }));
      const videoToSave = video?.url
        ? { name: video.name, url: video.url, start: video.start, ends: video.ends }
        : null;
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ prompt, settings, images: imagesToSave, video: videoToSave, audioIds, characterIds })
      );
    } catch {}
  }, [prompt, settings, images, video, audioIds, characterIds]);

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
    } finally {
      setBalanceLoading(false);
    }
  }
  useEffect(() => {
    if (apiKey) refreshBalance();
    else {
      setBalance(null);
      balanceRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey]);

  // ── Cuota: imágenes(1) + video(2) + characterIds(1) ≤ 7 ──
  const usedSlots = images.length + (video?.url ? 2 : 0) + characterIds.filter((c) => c.trim()).length;
  const slotsLeft = 7 - usedSlots;

  function patchImage(id, patch) {
    setImages((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }

  async function handleImageFiles(fileList) {
    if (!apiKey) return alert("Primero cargá tu API key de kie.ai arriba.");
    const room = Math.min(MAX_IMAGES - images.length, slotsLeft);
    if (room <= 0) return alert("No te quedan slots para más imágenes (cuota máxima 7).");
    const files = Array.from(fileList)
      .filter((f) => f.type.startsWith("image/"))
      .slice(0, room);
    for (const file of files) {
      const id = nextId();
      const preview = URL.createObjectURL(file);
      setImages((prev) => [...prev, { id, name: file.name, preview, url: "", uploading: true, error: "" }]);
      try {
        const { url } = await uploadFile(file, apiKey);
        patchImage(id, { url, uploading: false });
      } catch (err) {
        patchImage(id, { uploading: false, error: String(err.message || err) });
      }
    }
    if (imgRef.current) imgRef.current.value = "";
  }

  function removeImage(id) {
    setImages((prev) => prev.filter((i) => i.id !== id));
  }

  async function handleVideoFile(fileList) {
    if (!apiKey) return alert("Primero cargá tu API key de kie.ai arriba.");
    const file = Array.from(fileList).find((f) => f.type.startsWith("video/"));
    if (!file) return;
    if (video?.url && slotsLeft < 0) {
      // el video ya ocupa slots; reemplazar está ok
    }
    if (!video && slotsLeft < 2) return alert("No te quedan 2 slots libres para un video (cuota máxima 7).");
    const preview = URL.createObjectURL(file);
    setVideo({ name: file.name, preview, url: "", uploading: true, error: "", start: 0, ends: 10 });
    try {
      const { url } = await uploadFile(file, apiKey);
      setVideo((v) => ({ ...v, url, uploading: false }));
    } catch (err) {
      setVideo((v) => ({ ...v, uploading: false, error: String(err.message || err) }));
    }
    if (videoRef.current) videoRef.current.value = "";
  }

  function removeVideo() {
    setVideo(null);
  }

  // ── Drag & drop de archivos ──
  function isFileDrag(e) {
    const types = e.dataTransfer?.types;
    return types ? Array.from(types).includes("Files") : false;
  }
  function handleDragOver(e) {
    if (!isFileDrag(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    setFileDropActive(true);
  }
  function handleDragLeave(e) {
    if (e.currentTarget.contains(e.relatedTarget)) return;
    setFileDropActive(false);
  }
  function handleDrop(e) {
    if (!isFileDrag(e)) return;
    e.preventDefault();
    setFileDropActive(false);
    const files = Array.from(e.dataTransfer.files);
    const imgs = files.filter((f) => f.type.startsWith("image/"));
    const vids = files.filter((f) => f.type.startsWith("video/"));
    if (imgs.length) handleImageFiles(imgs);
    if (vids.length) handleVideoFile(vids);
  }

  // ── Listas de IDs (audio / character) ──
  function addId(setter, list, max) {
    if (list.length >= max) return;
    setter((prev) => [...prev, ""]);
  }
  function patchId(setter, idx, value) {
    setter((prev) => prev.map((v, i) => (i === idx ? value : v)));
  }
  function removeId(setter, idx) {
    setter((prev) => prev.filter((_, i) => i !== idx));
  }

  function resetAll() {
    if (!confirm("¿Restablecer todo? Se borran el prompt, imágenes, video e IDs.")) return;
    setPrompt("");
    setImages([]);
    setVideo(null);
    setAudioIds([]);
    setCharacterIds([]);
    setSettings(DEFAULT_SETTINGS);
    setStatus("idle");
    setTaskId(null);
    setRawState("");
    setVideoUrls([]);
    setError("");
    setCost(null);
  }

  const anyUploading = images.some((i) => i.uploading) || video?.uploading;
  const busy = status === "processing";

  async function generate() {
    if (!apiKey) return alert("Cargá tu API key primero.");
    if (!prompt.trim()) return alert("Escribí un prompt.");
    if (anyUploading) return alert("Esperá a que terminen de subir los archivos.");
    if (video && !video.url) return alert("El video todavía no terminó de subir.");
    if (usedSlots > 7) return alert("Superás la cuota de 7 slots. Sacá imágenes, video o character IDs.");

    setStatus("processing");
    setError("");
    setVideoUrls([]);
    setTaskId(null);
    setRawState("");
    setCost(null);

    const videoList = video?.url
      ? [{ url: video.url, start: Number(video.start) || 0, ends: Number(video.ends) || 10 }]
      : [];

    try {
      const { taskId: tId, videoUrls: urls } = await generateAndWait(
        {
          prompt: prompt.trim(),
          imageUrls: images.filter((i) => i.url).map((i) => i.url),
          audioIds: audioIds.map((s) => s.trim()).filter(Boolean),
          characterIds: characterIds.map((s) => s.trim()).filter(Boolean),
          videoList,
          duration: settings.duration,
          aspect_ratio: settings.aspect_ratio,
          resolution: settings.resolution,
          seed: settings.seed,
        },
        apiKey,
        { onUpdate: (u) => { setTaskId(u.taskId); setRawState(u.rawState || ""); } }
      );

      // Costo = diferencia de balance antes/después
      let c = null;
      try {
        const after = await getCredits(apiKey);
        if (balanceRef.current != null && after != null) c = Math.max(0, Math.round(balanceRef.current - after));
        if (after != null) {
          balanceRef.current = after;
          setBalance(after);
        }
      } catch {}

      setStatus("success");
      setTaskId(tId);
      setVideoUrls(urls || []);
      setCost(c);
    } catch (err) {
      setStatus("fail");
      setError(String(err.message || err));
    }
  }

  return (
    <div className="gemini-generator">
      <div className="app">
        <header className="g-header">
          <div>
            <Link href="/" className="back-link">
              <ArrowLeft size={15} /> Volver al portal
            </Link>
            <h1>🎥 Gemini Omni Video</h1>
          </div>
          <div className="header-right">
            <div className="balance" title="Créditos disponibles en tu cuenta de Kie.ai">
              <span className="balance-label">Balance</span>
              <span className="balance-value">
                {balance != null ? `${balance.toLocaleString("es-AR")} créditos` : "—"}
              </span>
              <button className="icon-btn" onClick={refreshBalance} disabled={!apiKey || balanceLoading} title="Actualizar balance">
                <RefreshCw size={14} className={balanceLoading ? "spin" : ""} />
              </button>
            </div>
            <button className="btn" onClick={resetAll}>
              <RotateCcw size={14} /> Restablecer
            </button>
          </div>
        </header>

        {/* API key */}
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
        </section>

        {/* Prompt */}
        <section className="card">
          <div className="row-between">
            <h2>Prompt</h2>
            <span className="hint" style={{ margin: 0 }}>{prompt.length}/20000</span>
          </div>
          <textarea
            className="prompt"
            rows={5}
            placeholder="Describí el video: escena, estilo, lenguaje de cámara, acciones del personaje…"
            value={prompt}
            maxLength={20000}
            disabled={busy}
            onChange={(e) => setPrompt(e.target.value)}
          />
        </section>

        {/* Cuota */}
        <section className="card quota-bar">
          <div className="quota-info">
            <strong>Cuota de slots:</strong> {usedSlots}/7 usados
            <span className="quota-detail"> · imagen = 1 · video = 2 · character ID = 1</span>
          </div>
          <div className="quota-track">
            {Array.from({ length: 7 }).map((_, i) => (
              <span key={i} className={"quota-dot" + (i < usedSlots ? " filled" : "")} />
            ))}
          </div>
        </section>

        {/* Imágenes + Video */}
        <section
          className={"card" + (fileDropActive ? " file-drop-active" : "")}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className="row-between">
            <h2>Imágenes de referencia ({images.length}/{MAX_IMAGES})</h2>
            <span className="hint" style={{ margin: 0 }}>{slotsLeft} slot(s) libre(s)</span>
          </div>
          <p className="hint">Arrastrá imágenes o un video acá, o usá los botones. Cada imagen ocupa 1 slot; el video ocupa 2.</p>

          <div className="images">
            {images.map((img, idx) => (
              <div className="thumb" key={img.id}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.preview} alt={img.name} />
                <div className="thumb-tag">Img {idx + 1}</div>
                <button className="thumb-x" onClick={() => removeImage(img.id)} title="Quitar" disabled={busy}>✕</button>
                <div className={"thumb-state " + (img.error ? "err" : img.url ? "ok" : "load")}>
                  {img.uploading ? "Subiendo…" : img.error ? "Error" : "Subida ✓"}
                </div>
              </div>
            ))}
            {images.length < MAX_IMAGES && slotsLeft > 0 && !busy && (
              <button className="thumb add" onClick={() => imgRef.current?.click()}>
                <Plus size={18} /> Imagen
              </button>
            )}
          </div>
          <input
            ref={imgRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            multiple
            hidden
            onChange={(e) => handleImageFiles(e.target.files)}
          />

          {/* Video */}
          <div className="video-block">
            <div className="row-between">
              <h2 style={{ marginBottom: 0 }}>Video de origen (opcional)</h2>
              {!video && slotsLeft >= 2 && !busy && (
                <button className="btn" onClick={() => videoRef.current?.click()}>
                  <Film size={14} /> Subir video
                </button>
              )}
            </div>
            <p className="hint">Máx 1 video (≤100MB). El recorte no puede superar 10s. Con video, la duración la decide el modelo.</p>
            <input
              ref={videoRef}
              type="file"
              accept="video/mp4,video/quicktime,video/webm"
              hidden
              onChange={(e) => handleVideoFile(e.target.files)}
            />
            {video && (
              <div className="video-item">
                <div className="video-preview">
                  {video.preview ? <video src={video.preview} controls preload="metadata" /> : null}
                  <div className={"thumb-state " + (video.error ? "err" : video.url ? "ok" : "load")}>
                    {video.uploading ? "Subiendo…" : video.error ? "Error" : "Subido ✓"}
                  </div>
                </div>
                <div className="video-trim">
                  <div className="video-name">{video.name}</div>
                  <label>
                    Start (s)
                    <input
                      type="number" min={0} step={1} value={video.start} disabled={busy}
                      onChange={(e) => setVideo((v) => ({ ...v, start: Number(e.target.value) }))}
                    />
                  </label>
                  <label>
                    Ends (s)
                    <input
                      type="number" min={0} step={1} value={video.ends} disabled={busy}
                      onChange={(e) => setVideo((v) => ({ ...v, ends: Number(e.target.value) }))}
                    />
                  </label>
                  <button className="btn" onClick={removeVideo} disabled={busy}>
                    <X size={14} /> Quitar
                  </button>
                </div>
                {video.error && <div className="scene-err">{video.error}</div>}
                {Number(video.ends) - Number(video.start) > 10 && (
                  <div className="scene-warn">⚠ El recorte supera 10s; se ajustará automáticamente.</div>
                )}
              </div>
            )}
          </div>
        </section>

        {/* IDs (audio / character) */}
        <section className="card">
          <div className="ids-grid">
            <div className="ids-col">
              <div className="row-between">
                <h2>Audio IDs ({audioIds.length}/{MAX_AUDIO})</h2>
                <button className="btn" disabled={audioIds.length >= MAX_AUDIO || busy} onClick={() => addId(setAudioIds, audioIds, MAX_AUDIO)}>
                  <Plus size={14} /> Agregar
                </button>
              </div>
              <p className="hint">IDs generados por gemini-omni-audio (narración, diálogo, música).</p>
              {audioIds.map((val, idx) => (
                <div className="id-row" key={idx}>
                  <input
                    placeholder="audio_01hx8p0demo" value={val} disabled={busy}
                    onChange={(e) => patchId(setAudioIds, idx, e.target.value)}
                  />
                  <button className="id-del" onClick={() => removeId(setAudioIds, idx)} disabled={busy}>✕</button>
                </div>
              ))}
              {audioIds.length === 0 && <p className="hint muted-empty">Sin audio IDs.</p>}
            </div>

            <div className="ids-col">
              <div className="row-between">
                <h2>Character IDs ({characterIds.length}/{MAX_CHARS})</h2>
                <button
                  className="btn"
                  disabled={characterIds.length >= MAX_CHARS || slotsLeft <= 0 || busy}
                  onClick={() => addId(setCharacterIds, characterIds, MAX_CHARS)}
                >
                  <Plus size={14} /> Agregar
                </button>
              </div>
              <p className="hint">IDs de gemini-omni-character. Cada uno ocupa 1 slot.</p>
              {characterIds.map((val, idx) => (
                <div className="id-row" key={idx}>
                  <input
                    placeholder="character_01hx8p0demo" value={val} disabled={busy}
                    onChange={(e) => patchId(setCharacterIds, idx, e.target.value)}
                  />
                  <button className="id-del" onClick={() => removeId(setCharacterIds, idx)} disabled={busy}>✕</button>
                </div>
              ))}
              {characterIds.length === 0 && <p className="hint muted-empty">Sin character IDs.</p>}
            </div>
          </div>
        </section>

        {/* Ajustes */}
        <section className="card">
          <h2>Ajustes</h2>
          <div className="settings">
            <div className="selector">
              <span>Duración (s){video?.url ? " · la decide el modelo con video" : ""}</span>
              <div className="pills">
                {DURATIONS.map((d) => (
                  <button
                    key={d}
                    className={"pill" + (settings.duration === d ? " active" : "")}
                    disabled={busy}
                    onClick={() => setSettings((s) => ({ ...s, duration: d }))}
                  >
                    {d}s
                  </button>
                ))}
              </div>
            </div>
            <div className="selector">
              <span>Aspect ratio</span>
              <div className="pills">
                {ASPECTS.map((a) => (
                  <button
                    key={a}
                    className={"pill" + (settings.aspect_ratio === a ? " active" : "")}
                    disabled={busy}
                    onClick={() => setSettings((s) => ({ ...s, aspect_ratio: a }))}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </div>
            <div className="selector">
              <span>Resolución</span>
              <div className="pills">
                {RESOLUTIONS.map((r) => (
                  <button
                    key={r}
                    className={"pill" + (settings.resolution === r ? " active" : "")}
                    disabled={busy}
                    onClick={() => setSettings((s) => ({ ...s, resolution: r }))}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
            <label className="sfield">
              <span>Seed (opcional)</span>
              <input
                type="number" min={0} max={2147483647} placeholder="auto"
                value={settings.seed} disabled={busy}
                onChange={(e) => setSettings((s) => ({ ...s, seed: e.target.value }))}
                style={{ width: 140 }}
              />
            </label>
          </div>
        </section>

        {/* Generar + resultado */}
        <section className={"card result-card " + status}>
          <div className="row-between" style={{ marginBottom: 12 }}>
            <div className="result-status">
              {cost != null && <span className="cost-pill">−{cost} créditos</span>}
              {taskId && <span className="taskid">task: {taskId} {rawState && `(${rawState})`}</span>}
            </div>
            <button className="btn primary big" disabled={busy || anyUploading} onClick={generate}>
              {busy ? "Generando…" : "▶ Generar video"}
            </button>
          </div>

          {error && <div className="scene-err">{error}</div>}

          {busy && (
            <div className="loading-note">Generando… esto puede tardar 1-3 minutos. No cierres la pestaña.</div>
          )}

          {videoUrls.length > 0 && (
            <div className="results">
              {videoUrls.map((u, i) => (
                <div key={i} className="result">
                  <video src={u} controls preload="metadata" />
                  <a href={u} target="_blank" rel="noreferrer" download>
                    <Download size={13} /> Descargar video
                  </a>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
