"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import styles from "./admin.module.css";

const ADMIN_USER = "santi";
const ADMIN_PASS = "123456";

const fmt = (n) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n);

const QUANTITY_OPTIONS = [
  "1 unidad", "2 unidades", "3 unidades", "4 unidades", "5 unidades", "6 unidades",
  "30 cápsulas", "60 cápsulas", "90 cápsulas", "120 cápsulas",
  "150 cápsulas", "180 cápsulas", "240 cápsulas", "300 cápsulas", "360 cápsulas",
  "Personalizado",
];

// ── Login ─────────────────────────────────────────────────────
function LoginGate({ onLogin }) {
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");

  function handleSubmit(e) {
    e.preventDefault();
    if (user === ADMIN_USER && pass === ADMIN_PASS) {
      onLogin();
    } else {
      toast.error("Credenciales incorrectas");
    }
  }

  return (
    <div className={styles.loginWrap}>
      <div className={styles.loginCard}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logos/logo.jpg" alt="Logo" className={styles.loginLogo} />
        <h2 className={styles.loginTitle}>Panel Admin</h2>
        <p className={styles.loginSub}>Real Ecom Calculator</p>
        <form onSubmit={handleSubmit} className={styles.loginForm}>
          <label className={styles.loginLabel}>Usuario</label>
          <input className={styles.loginInput} type="text" value={user} onChange={(e) => setUser(e.target.value)} autoFocus placeholder="Usuario" />
          <label className={styles.loginLabel} style={{ marginTop: "0.875rem" }}>Contraseña</label>
          <input className={styles.loginInput} type="password" value={pass} onChange={(e) => setPass(e.target.value)} placeholder="••••••" />
          <button type="submit" className={styles.loginBtn}>Ingresar</button>
        </form>
        <a href="/calculadora" className={styles.backLink}>← Volver a la calculadora</a>
      </div>
    </div>
  );
}

// ── Admin panel ────────────────────────────────────────────────
export default function AdminPage() {
  const [authed, setAuthed]       = useState(false);
  const [loading, setLoading]     = useState(false);
  const [saving, setSaving]       = useState(false);
  const [dolar, setDolar]         = useState(null);
  const [settings, setSettings]   = useState(null);
  const [offers, setOffers]       = useState([]);
  const [customQty, setCustomQty] = useState({});

  useEffect(() => {
    if (sessionStorage.getItem("admin_ok") === "1") setAuthed(true);
  }, []);

  function handleLogin() {
    sessionStorage.setItem("admin_ok", "1");
    setAuthed(true);
  }

  useEffect(() => {
    if (!authed) return;
    setLoading(true);
    Promise.all([
      fetch("/api/calculator").then((r) => r.json()),
      fetch("/api/dolar").then((r) => r.json()),
    ])
      .then(([calcData, dolarData]) => {
        setSettings(calcData.settings);
        setOffers(calcData.offers);
        setDolar(dolarData);
      })
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, [authed]);

  useEffect(() => {
    if (!authed) return;
    const iv = setInterval(() => {
      fetch("/api/dolar").then((r) => r.json()).then(setDolar).catch(() => {});
    }, 3 * 60 * 1000);
    return () => clearInterval(iv);
  }, [authed]);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/calculator", {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-admin-password": ADMIN_PASS },
        body: JSON.stringify({ settings, offers }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("Guardado en Supabase correctamente");
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  const updateSetting = (key, val) => setSettings((s) => ({ ...s, [key]: val }));
  const updateOffer   = (id, key, val) => setOffers((p) => p.map((o) => (o.id === id ? { ...o, [key]: val } : o)));

  if (!authed) return <LoginGate onLogin={handleLogin} />;
  if (loading)  return (
    <div className={styles.loadingWrap}>
      <div className="spinner" />
      <p>Cargando panel…</p>
    </div>
  );

  return (
    <div className={styles.page}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.headerLeft}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logos/logo.jpg" alt="Logo" className={styles.logo} />
            <div className={styles.titleGroup}>
              <span className={styles.title}>Panel Admin</span>
              <span className={styles.subtitle}>Real Ecom Calculator</span>
            </div>
          </div>
          <div className={styles.headerRight}>
            {dolar && (
              <div className={styles.dolarBar}>
                <div className={styles.dolarItem}>
                  <span className={styles.dolarLabel}>Blue</span>
                  <span className={styles.dolarValue}>V: {fmt(dolar.blue?.venta)} · C: {fmt(dolar.blue?.compra)}</span>
                </div>
                <div className={styles.dolarSep} />
                <div className={styles.dolarItem}>
                  <span className={styles.dolarLabel}>Cripto</span>
                  <span className={`${styles.dolarValue} ${styles.dolarCripto}`}>V: {fmt(dolar.cripto?.venta)} · C: {fmt(dolar.cripto?.compra)}</span>
                </div>
              </div>
            )}
            <a href="/calculadora" className={`${styles.btnDark}`}>Ver calculadora</a>
          </div>
        </div>
      </header>

      <div className={styles.content}>
        {/* ── Ofertas ── */}
        <div className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTitle}>Ofertas</span>
            <span className={styles.sectionNote}>Cantidades, precios, costos y objetivos CPA BE (USD)</span>
          </div>
          <div className={styles.sectionBody}>
            <div className={styles.offersGrid}>
              {offers.map((offer) => (
                <div key={offer.id} className={styles.offerBlock}>
                  <p className={styles.offerTitle}>{offer.name}</p>

                  <div style={{ marginBottom: "0.75rem" }}>
                    <label className={styles.fieldLabel}>Presentación</label>
                    <select
                      className={`${styles.darkInput} ${styles.darkSelect}`}
                      value={QUANTITY_OPTIONS.includes(offer.quantity_label) ? offer.quantity_label : "Personalizado"}
                      onChange={(e) => {
                        if (e.target.value === "Personalizado") {
                          setCustomQty((c) => ({ ...c, [offer.id]: true }));
                        } else {
                          setCustomQty((c) => ({ ...c, [offer.id]: false }));
                          updateOffer(offer.id, "quantity_label", e.target.value);
                        }
                      }}
                    >
                      {QUANTITY_OPTIONS.map((q) => <option key={q}>{q}</option>)}
                    </select>
                    {(customQty[offer.id] || !QUANTITY_OPTIONS.includes(offer.quantity_label)) && (
                      <input
                        className={styles.darkInput}
                        type="text"
                        placeholder="Ej: 90 cápsulas"
                        value={offer.quantity_label}
                        onChange={(e) => updateOffer(offer.id, "quantity_label", e.target.value)}
                        style={{ marginTop: "0.5rem" }}
                      />
                    )}
                  </div>

                  <div style={{ marginBottom: "0.75rem" }}>
                    <label className={styles.fieldLabel}>Precio de venta (ARS)</label>
                    <input className={styles.darkInput} type="number" value={offer.sale_price || ""} onChange={(e) => updateOffer(offer.id, "sale_price", e.target.value)} placeholder="0" />
                  </div>

                  <div style={{ marginBottom: "0.75rem" }}>
                    <label className={styles.fieldLabel}>Costo producto (ARS)</label>
                    <input className={styles.darkInput} type="number" value={offer.product_cost || ""} onChange={(e) => updateOffer(offer.id, "product_cost", e.target.value)} placeholder="0" />
                  </div>

                  <div>
                    <label className={styles.fieldLabel}>Objetivo CPA BE (USD)</label>
                    <input className={styles.darkInput} type="number" step="0.01" value={offer.cpa_be_target || ""} onChange={(e) => updateOffer(offer.id, "cpa_be_target", e.target.value)} placeholder="0.00" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Comisiones MP ── */}
        {settings && (
          <div className={styles.sectionCard}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionTitle}>Comisiones MercadoPago</span>
            </div>
            <div className={styles.sectionBody}>
              <div className={styles.feesGrid}>
                <div>
                  <p className={styles.feeGroupTitle}>Plazo de acreditación (%)</p>
                  <div className={styles.feeRow}>
                    {[
                      { label: "Al instante", key: "ml_fee_instante" },
                      { label: "10 días",     key: "ml_fee_10dias"   },
                      { label: "18 días",     key: "ml_fee_18dias"   },
                      { label: "35 días",     key: "ml_fee_35dias"   },
                    ].map((f) => (
                      <div key={f.key} className={styles.feeField}>
                        <label className={styles.fieldLabel}>{f.label}</label>
                        <input className={styles.darkInput} type="number" step="0.01" value={settings[f.key] ?? ""} onChange={(e) => updateSetting(f.key, e.target.value)} />
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <p className={styles.feeGroupTitle}>Cuotas sin interés — adicional (%)</p>
                  <div className={styles.feeRow}>
                    {[
                      { label: "2 cuotas", key: "ml_cuotas_2" },
                      { label: "3 cuotas", key: "ml_cuotas_3" },
                    ].map((f) => (
                      <div key={f.key} className={styles.feeField}>
                        <label className={styles.fieldLabel}>{f.label}</label>
                        <input className={styles.darkInput} type="number" step="0.01" value={settings[f.key] ?? ""} onChange={(e) => updateSetting(f.key, e.target.value)} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Otros costos ── */}
        {settings && (
          <div className={styles.sectionCard}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionTitle}>Otros costos y comisiones</span>
            </div>
            <div className={styles.sectionBody}>
              <div className={styles.feeRow}>
                {[
                  { label: "IIBB (%)",      key: "iibb_pct",       step: "0.01" },
                  { label: "Comisión (%)",   key: "commission_pct", step: "0.01" },
                  { label: "Envío (ARS)",    key: "shipping_ars",   step: "1"    },
                ].map((f) => (
                  <div key={f.key} className={styles.feeField}>
                    <label className={styles.fieldLabel}>{f.label}</label>
                    <input className={styles.darkInput} type="number" step={f.step} value={settings[f.key] ?? ""} onChange={(e) => updateSetting(f.key, e.target.value)} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Guardar ── */}
        <div className={styles.saveBar}>
          <p className={styles.saveNote}>
            Los cambios se guardan en Supabase y se convierten en los nuevos defaults.
            Los usuarios que hayan modificado valores locales deberán usar &ldquo;Restablecer&rdquo; para actualizarlos.
          </p>
          <button className={styles.saveBtn} onClick={handleSave} disabled={saving}>
            {saving ? "Guardando…" : "Guardar en Supabase"}
          </button>
        </div>
      </div>
    </div>
  );
}
