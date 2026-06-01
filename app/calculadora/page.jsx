"use client";
import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import styles from "./calculadora.module.css";

// ─── Formatters ──────────────────────────────────────────────
const fmt    = (n) => new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n);
const fmtUSD = (n) => new Intl.NumberFormat("es-AR", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
const fmtPct = (n) => `${Number(n).toFixed(2)}%`;

const STORAGE_KEY = "calc_v5";
const PRESETS_KEY = "calc_presets_v1";

const BASE_FEE_OPTIONS = [
  { label: "Al instante",  key: "ml_fee_instante" },
  { label: "10 días",      key: "ml_fee_10dias"   },
  { label: "18 días",      key: "ml_fee_18dias"   },
  { label: "35 días",      key: "ml_fee_35dias"   },
];
const CUOTAS_OPTIONS = [
  { label: "Sin cuotas",     key: null },
  { label: "Hasta 2 cuotas", key: "ml_cuotas_2" },
  { label: "Hasta 3 cuotas", key: "ml_cuotas_3" },
];

const MP_IVA = 21; // siempre 21%, no configurable

// ─── Money input with dot-formatted display ──────────────────
function MoneyInput({ value, onChange, placeholder, className }) {
  const [editing, setEditing] = useState(false);
  const [raw, setRaw]         = useState("");
  return (
    <input
      type="text"
      inputMode="numeric"
      value={editing ? raw : (value ? Number(value).toLocaleString("es-AR", { maximumFractionDigits: 0 }) : "")}
      onChange={(e) => { const v = e.target.value.replace(/[^\d]/g, ""); setRaw(v); onChange(Number(v) || 0); }}
      onFocus={() => { setEditing(true); setRaw(String(Number(value) || "")); }}
      onBlur={() => setEditing(false)}
      placeholder={placeholder}
      className={className}
    />
  );
}

// ─── Calculation ─────────────────────────────────────────────
function calcOffer({ offer, settings, baseFeeKey, cuotasKey, cryptoRate, fixedCosts = [] }) {
  const salePrice   = Number(offer.sale_price)        || 0;
  const productCost = Number(offer.product_cost)      || 0;
  const shipping    = Number(settings.shipping_ars)   || 0;
  const iibb        = Number(settings.iibb_pct)       || 0;
  const commission  = Number(settings.commission_pct) || 0;
  const baseFee     = Number(settings[baseFeeKey])    || 0;
  const cuotasFee   = cuotasKey ? Number(settings[cuotasKey]) || 0 : 0;
  const mpNet       = baseFee + cuotasFee;
  const mpIvaFactor = 1 + MP_IVA / 100;
  const costMP         = salePrice * (mpNet / 100) * mpIvaFactor;
  const costIIBB       = salePrice * iibb / 100;
  const costCommission = salePrice * commission / 100;
  const fixedTotal     = fixedCosts.reduce((sum, fc) => {
    const a = Number(fc.amount || 0);
    return sum + (fc.type === "pct" ? salePrice * a / 100 : a);
  }, 0);
  const totalCosts = productCost + shipping + costMP + costIIBB + costCommission + fixedTotal;
  const disponible = salePrice - totalCosts;
  const cpaBeUSD   = cryptoRate > 0 ? disponible / cryptoRate : null;
  const cpaBeARS   = disponible;
  const margin     = salePrice > 0 ? (disponible / salePrice) * 100 : 0;
  return { salePrice, productCost, shipping, iibb, commission, mpNet, costMP, costIIBB, costCommission, fixedTotal, totalCosts, disponible, cpaBeUSD, cpaBeARS, margin };
}

// ─── Offer Card ──────────────────────────────────────────────
function OfferCard({ offer, settings, baseFeeKey, cuotasKey, cryptoRate, fixedCosts, cpaUnit, onChange, onToggleHide }) {
  const hidden  = offer.hidden;
  const c       = calcOffer({ offer, settings, baseFeeKey, cuotasKey, cryptoRate, fixedCosts });

  // CPA objetivo = Santi's target per offer (max CPA we want to pay)
  const objetivo    = Number(offer.cpa_be_target) || 0;
  // CPA BE = what we can afford = formula result
  const cpaBE_USD   = c.cpaBeUSD;
  const cpaBE       = cpaUnit === "ars" ? c.cpaBeARS : cpaBE_USD;
  const fmtCPA      = cpaUnit === "ars" ? fmt : fmtUSD;
  const cpaLabel    = cpaUnit === "ars" ? "CPA BE (ARS)" : "CPA BE (USD)";
  // ok = formula says we can afford the target CPA
  const ok          = cpaBE_USD !== null && objetivo > 0 && cpaBE_USD >= objetivo;

  // Margin = net profit after paying target CPA
  const objetivoARS = objetivo > 0 && cryptoRate > 0 ? objetivo * cryptoRate : 0;
  const netProfit   = c.disponible - objetivoARS;
  const netMargin   = c.salePrice > 0 ? (netProfit / c.salePrice) * 100 : 0;

  return (
    <div className={`${styles.offerCard} ${objetivo > 0 ? (ok ? styles.offerOk : styles.offerBad) : ""} ${hidden ? styles.offerHidden : ""}`}>
      {/* Header editable */}
      <div className={styles.offerHeader}>
        <div className={styles.offerTitles}>
          <input className={styles.nameInput} value={offer.name} onChange={(e) => onChange({ ...offer, name: e.target.value })} placeholder="Nombre" />
          <input className={styles.qtyInput}  value={offer.quantity_label} onChange={(e) => onChange({ ...offer, quantity_label: e.target.value })} placeholder="Cantidad" />
        </div>
        <div className={styles.offerHeaderRight}>
          {objetivo > 0 && (
            <span className={`${styles.offerBadge} ${ok ? styles.badgeOk : styles.badgeBad}`}>{ok ? "OK" : "ALTO"}</span>
          )}
          <button className={styles.hideBtn} onClick={() => onToggleHide(offer.id)} title={hidden ? "Mostrar" : "Ocultar"}>
            {hidden ? "👁" : "–"}
          </button>
        </div>
      </div>

      {hidden && (
        <div className={styles.hiddenOverlay}>
          <button className={styles.showBtn} onClick={() => onToggleHide(offer.id)}>Mostrar oferta</button>
        </div>
      )}

      <div className={hidden ? styles.hiddenContent : ""}>
        {/* Precio de venta */}
        <div className={styles.inputRow}>
          <label className={styles.inputLabel}>Precio de venta</label>
          <div className={styles.moneyBox}>
            <span className={styles.moneyPre}>$</span>
            <MoneyInput value={offer.sale_price} onChange={(v) => onChange({ ...offer, sale_price: v })} placeholder="0" className={styles.moneyField} />
          </div>
        </div>

        {/* Costo producto + CPA objetivo — misma fila 3/4 + 1/4 */}
        <div className={styles.inputRowDouble}>
          <div>
            <label className={styles.inputLabel}>Costo producto</label>
            <div className={styles.moneyBox}>
              <span className={styles.moneyPre}>$</span>
              <MoneyInput value={offer.product_cost} onChange={(v) => onChange({ ...offer, product_cost: v })} placeholder="0" className={styles.moneyField} />
            </div>
          </div>
          <div>
            <label className={styles.inputLabel}>CPA</label>
            <div className={styles.moneyBox}>
              <span className={styles.moneyPre}>$</span>
              <input
                type="number" step="0.01"
                value={offer.cpa_be_target || ""}
                onChange={(e) => onChange({ ...offer, cpa_be_target: e.target.value })}
                placeholder="0.00"
                className={`${styles.moneyField} ${styles.moneyFieldCpa}`}
              />
            </div>
          </div>
        </div>

        {/* Breakdown */}
        <div className={styles.breakdown}>
          <div className={styles.bRow}><span>Envío</span><span>{fmt(c.shipping)}</span></div>
          <div className={styles.bRow}><span>MP {fmtPct(c.mpNet)} + IVA</span><span>{fmt(c.costMP)}</span></div>
          <div className={styles.bRow}><span>IIBB ({fmtPct(c.iibb)})</span><span>{fmt(c.costIIBB)}</span></div>
          {c.commission > 0 && <div className={styles.bRow}><span>Comisión ({fmtPct(c.commission)})</span><span>{fmt(c.costCommission)}</span></div>}
          {fixedCosts.filter((fc) => fc.amount).map((fc) => (
            <div key={fc.id} className={styles.bRow}>
              <span>{fc.name || "Extra"} {fc.type === "pct" ? `(${fc.amount}%)` : ""}</span>
              <span>{fmt(fc.type === "pct" ? c.salePrice * Number(fc.amount) / 100 : Number(fc.amount))}</span>
            </div>
          ))}
          <div className={`${styles.bRow} ${styles.bTotal}`}><span>Total costos</span><span>{fmt(c.totalCosts)}</span></div>
        </div>

        {/* CPA BE result */}
        <div className={styles.cpaSection}>
          <div className={styles.cpaRow}>
            <div>
              <p className={styles.cpaLabel}>{cpaLabel}</p>
              <p className={`${styles.cpaValue} ${objetivo > 0 ? (ok ? styles.cpaOk : styles.cpaBad) : ""}`}>
                {cpaBE === null ? "—" : fmtCPA(cpaBE)}
              </p>
            </div>
            <div style={{ textAlign: "right" }}>
              <p className={styles.cpaLabel}>Objetivo</p>
              <p className={styles.cpaTargetValue}>{objetivo > 0 ? fmtUSD(objetivo) : "—"}</p>
            </div>
          </div>
          <p className={styles.margin}>Margen: <strong>{netMargin.toFixed(1)}%</strong></p>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────
export default function CalculadoraPage() {
  const [settings, setSettings]       = useState(null);
  const [offers, setOffers]           = useState([]);
  const [dolar, setDolar]             = useState(null);
  const [loading, setLoading]         = useState(true);
  const [showConfig, setShowConfig]   = useState(false);
  const [showFixed, setShowFixed]     = useState(false);
  const [showPresets, setShowPresets] = useState(false);
  const [baseFeeKey, setBaseFeeKey]   = useState("ml_fee_10dias");
  const [cuotasKey, setCuotasKey]     = useState(null);
  const [cpaUnit, setCpaUnit]         = useState("usd");
  const [fixedCosts, setFixedCosts]   = useState([]);
  const [presets, setPresets]         = useState([]);
  const [presetName, setPresetName]   = useState("");

  const loadFromDB = useCallback(async () => {
    const res = await fetch("/api/calculator");
    if (!res.ok) throw new Error("Error al cargar config");
    return res.json();
  }, []);

  const loadDolar = useCallback(async () => {
    try { const r = await fetch("/api/dolar"); if (r.ok) setDolar(await r.json()); } catch { /* silencioso */ }
  }, []);

  useEffect(() => {
    const savedPresets = localStorage.getItem(PRESETS_KEY);
    if (savedPresets) { try { setPresets(JSON.parse(savedPresets)); } catch { } }
  }, []);

  useEffect(() => {
    async function init() {
      try {
        const dbData = await loadFromDB();
        const cached = localStorage.getItem(STORAGE_KEY);
        let loaded = null;
        if (cached) { try { loaded = JSON.parse(cached); } catch { } }
        if (loaded) {
          setSettings(loaded.settings || dbData.settings);
          setOffers(loaded.offers    || dbData.offers);
          if (loaded.baseFeeKey) setBaseFeeKey(loaded.baseFeeKey);
          if (loaded.cuotasKey  !== undefined) setCuotasKey(loaded.cuotasKey);
          if (loaded.cpaUnit)    setCpaUnit(loaded.cpaUnit);
          if (loaded.fixedCosts) setFixedCosts(loaded.fixedCosts);
        } else {
          setSettings(dbData.settings);
          setOffers(dbData.offers);
        }
      } catch (e) {
        toast.error(e.message);
      } finally {
        setLoading(false);
      }
    }
    init();
    loadDolar();
    const iv = setInterval(loadDolar, 3 * 60 * 1000);
    return () => clearInterval(iv);
  }, [loadFromDB, loadDolar]);

  // Auto-save to localStorage
  const getConfigSnapshot = useCallback(() => ({
    settings, offers, baseFeeKey, cuotasKey, cpaUnit, fixedCosts,
  }), [settings, offers, baseFeeKey, cuotasKey, cpaUnit, fixedCosts]);

  useEffect(() => {
    if (!settings) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(getConfigSnapshot()));
  }, [settings, offers, baseFeeKey, cuotasKey, cpaUnit, fixedCosts, getConfigSnapshot]);

  // Reset
  async function handleReset() {
    try {
      const data = await loadFromDB();
      setSettings(data.settings); setOffers(data.offers);
      setBaseFeeKey("ml_fee_10dias"); setCuotasKey(null); setCpaUnit("usd"); setFixedCosts([]);
      localStorage.removeItem(STORAGE_KEY);
      toast.success("Valores restablecidos");
    } catch (e) { toast.error(e.message); }
  }

  // Presets
  function savePreset() {
    if (!presetName.trim()) { toast.error("Poné un nombre"); return; }
    const p = { id: Date.now(), name: presetName.trim(), ...getConfigSnapshot(), savedAt: new Date().toISOString() };
    const updated = [...presets, p];
    setPresets(updated);
    localStorage.setItem(PRESETS_KEY, JSON.stringify(updated));
    setPresetName("");
    toast.success(`Set guardado`);
  }
  function loadPreset(p) {
    setSettings(p.settings); setOffers(p.offers || offers);
    setBaseFeeKey(p.baseFeeKey || "ml_fee_10dias");
    setCuotasKey(p.cuotasKey ?? null);
    setCpaUnit(p.cpaUnit || "usd");
    setFixedCosts(p.fixedCosts || []);
    toast.success(`Set cargado`);
  }
  function deletePreset(id) {
    const updated = presets.filter((p) => p.id !== id);
    setPresets(updated);
    localStorage.setItem(PRESETS_KEY, JSON.stringify(updated));
  }

  // Fixed costs
  const addFC    = () => setFixedCosts((p) => [...p, { id: Date.now(), name: "", type: "value", amount: "" }]);
  const updateFC = (id, k, v) => setFixedCosts((p) => p.map((fc) => fc.id === id ? { ...fc, [k]: v } : fc));
  const removeFC = (id) => setFixedCosts((p) => p.filter((fc) => fc.id !== id));

  // Offer helpers
  const updateOffer   = (updated) => setOffers((p) => p.map((o) => o.id === updated.id ? updated : o));
  const toggleHide    = (id) => setOffers((p) => p.map((o) => o.id === id ? { ...o, hidden: !o.hidden } : o));
  const updateSetting = (k, v) => setSettings((s) => ({ ...s, [k]: v }));

  const cryptoRate = dolar?.cripto?.venta || 0;
  const mpNet      = settings ? Number(settings[baseFeeKey] || 0) + (cuotasKey ? Number(settings[cuotasKey] || 0) : 0) : 0;
  const mpEfect    = mpNet * (1 + MP_IVA / 100);

  if (loading) return (
    <div className={styles.loadingWrap}>
      <div className="spinner" />
      <p style={{ color: "var(--text-mid)" }}>Cargando…</p>
    </div>
  );

  return (
    <div className={styles.page}>
      {/* ── Header ── */}
      <header className={styles.header}>
        <div className={styles.headerInner}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logos/logo.jpg" alt="Real Ecom Academy" className={styles.logo} />

          {dolar ? (
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
          ) : <span className={styles.dolarMuted}>Cargando cotizaciones…</span>}

          <div className={styles.headerActions}>
            <button className={styles.btnDark} onClick={handleReset}>Restablecer</button>
          </div>
        </div>
      </header>

      {/* ── Config bar ── */}
      <div className={styles.configBar}>
        <div className={styles.configBarInner}>
          <div className={styles.configBarLeft}>
            <div className={styles.configGroup}>
              <label className={styles.configLabel}>Plazo MP</label>
              <select value={baseFeeKey} onChange={(e) => setBaseFeeKey(e.target.value)} className={styles.configSelect}>
                {BASE_FEE_OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.label} ({fmtPct(settings?.[o.key] || 0)})</option>)}
              </select>
            </div>
            <div className={styles.configGroup}>
              <label className={styles.configLabel}>Cuotas sin interés</label>
              <select value={cuotasKey || ""} onChange={(e) => setCuotasKey(e.target.value || null)} className={styles.configSelect}>
                {CUOTAS_OPTIONS.map((o) => <option key={o.key || "none"} value={o.key || ""}>{o.label}{o.key ? ` (+${fmtPct(settings?.[o.key] || 0)})` : ""}</option>)}
              </select>
            </div>
            <div className={styles.mpBadge}>
              MP efectivo: <strong>{fmtPct(mpEfect)}</strong>
              <span className={styles.mpNote}> (neto {fmtPct(mpNet)} + IVA {MP_IVA}%)</span>
            </div>
            <div className={styles.cpaToggleWrap}>
              <label className={styles.configLabel}>CPA BE en</label>
              <div className={styles.toggleGroup}>
                <button className={`${styles.togBtn} ${cpaUnit === "usd" ? styles.togActive : ""}`} onClick={() => setCpaUnit("usd")}>USD</button>
                <button className={`${styles.togBtn} ${cpaUnit === "ars" ? styles.togActive : ""}`} onClick={() => setCpaUnit("ars")}>ARS</button>
              </div>
            </div>
          </div>
          <div className={styles.configBarRight}>
            <button className={`${styles.btnDark} ${showConfig   ? styles.btnActive : ""}`} onClick={() => setShowConfig((v) => !v)}>⚙ Config</button>
            <button className={`${styles.btnDark} ${showFixed    ? styles.btnActive : ""}`} onClick={() => setShowFixed((v) => !v)}>+ Costos</button>
            <button className={`${styles.btnDark} ${showPresets  ? styles.btnActive : ""}`} onClick={() => setShowPresets((v) => !v)}>Sets</button>
          </div>
        </div>
      </div>

      {/* ── Config panel ── */}
      {showConfig && settings && (
        <div className={styles.subPanel}>
          <div className={styles.subPanelInner}>
            <p className={styles.subPanelTitle}>Personalizar comisiones</p>
            <div className={styles.configGrid}>
              <div>
                <p className={styles.configSectionTitle}>Plazo acreditación MP (%)</p>
                <div className={styles.configRow}>
                  {BASE_FEE_OPTIONS.map((o) => (
                    <label key={o.key} className={styles.configField}>
                      <span>{o.label}</span>
                      <input type="number" step="0.01" value={settings[o.key] || ""} onChange={(e) => updateSetting(o.key, e.target.value)} className={styles.configInput} />
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <p className={styles.configSectionTitle}>Cuotas sin interés — adicional (%)</p>
                <div className={styles.configRow}>
                  {[{ label: "2 cuotas", key: "ml_cuotas_2" }, { label: "3 cuotas", key: "ml_cuotas_3" }].map((o) => (
                    <label key={o.key} className={styles.configField}>
                      <span>{o.label}</span>
                      <input type="number" step="0.01" value={settings[o.key] || ""} onChange={(e) => updateSetting(o.key, e.target.value)} className={styles.configInput} />
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <p className={styles.configSectionTitle}>Otros costos</p>
                <div className={styles.configRow}>
                  {[["IIBB (%)", "iibb_pct", "0.01"], ["Comisión (%)", "commission_pct", "0.01"], ["Envío (ARS)", "shipping_ars", "1"]].map(([lbl, key, step]) => (
                    <label key={key} className={styles.configField}>
                      <span>{lbl}</span>
                      <input type="number" step={step} value={settings[key] ?? ""} onChange={(e) => updateSetting(key, e.target.value)} className={styles.configInput} />
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <p className={styles.configHint}>Cambios locales. &ldquo;Restablecer&rdquo; recupera los defaults del servidor.</p>
          </div>
        </div>
      )}

      {/* ── Fixed costs panel ── */}
      {showFixed && (
        <div className={styles.subPanel}>
          <div className={styles.subPanelInner}>
            <p className={styles.subPanelTitle}>Costos adicionales <span className={styles.subPanelNote}>— se aplican a todas las ofertas</span></p>
            <div className={styles.fcList}>
              {fixedCosts.map((fc) => (
                <div key={fc.id} className={styles.fcRow}>
                  <input type="text" placeholder="Nombre" value={fc.name} onChange={(e) => updateFC(fc.id, "name", e.target.value)} className={styles.fcName} />
                  <select value={fc.type} onChange={(e) => updateFC(fc.id, "type", e.target.value)} className={styles.fcType}>
                    <option value="value">$ ARS</option>
                    <option value="pct">% precio</option>
                  </select>
                  <input type="number" step={fc.type === "pct" ? "0.01" : "1"} placeholder="0" value={fc.amount} onChange={(e) => updateFC(fc.id, "amount", e.target.value)} className={styles.fcAmt} />
                  <button className={styles.fcDel} onClick={() => removeFC(fc.id)}>×</button>
                </div>
              ))}
              {fixedCosts.length === 0 && <p className={styles.fcEmpty}>Sin costos adicionales.</p>}
            </div>
            <button className={styles.addBtn} onClick={addFC}>+ Agregar costo</button>
          </div>
        </div>
      )}

      {/* ── Presets panel ── */}
      {showPresets && (
        <div className={styles.subPanel}>
          <div className={styles.subPanelInner}>
            <p className={styles.subPanelTitle}>Sets guardados</p>
            <div className={styles.presetSaveRow}>
              <input
                type="text"
                placeholder="Nombre del set…"
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && savePreset()}
                className={styles.presetNameInput}
              />
              <button className={`${styles.btnDark} ${styles.btnAccent}`} onClick={savePreset}>Guardar set actual</button>
            </div>
            {presets.length > 0 ? (
              <div className={styles.presetList}>
                {presets.map((p) => (
                  <div key={p.id} className={styles.presetItem}>
                    <span className={styles.presetName}>{p.name}</span>
                    <div className={styles.presetActions}>
                      <button className={styles.btnDark} onClick={() => loadPreset(p)}>Cargar</button>
                      <button className={styles.btnDark} style={{ color: "var(--danger)" }} onClick={() => deletePreset(p.id)}>×</button>
                    </div>
                  </div>
                ))}
              </div>
            ) : <p className={styles.fcEmpty}>No hay sets guardados.</p>}
          </div>
        </div>
      )}

      {/* ── Content ── */}
      <div className={styles.inner}>
        {cryptoRate > 0 && (
          <p className={styles.cryptoRef}>Dólar cripto venta: <strong style={{ color: "#818cf8" }}>{fmt(cryptoRate)}</strong></p>
        )}

        <div className={styles.offersGrid}>
          {offers.map((offer) => (
            <OfferCard
              key={offer.id}
              offer={offer}
              settings={settings}
              baseFeeKey={baseFeeKey}
              cuotasKey={cuotasKey}
              cryptoRate={cryptoRate}
              fixedCosts={fixedCosts}
              cpaUnit={cpaUnit}
              onChange={updateOffer}
              onToggleHide={toggleHide}
            />
          ))}
        </div>

        {/* Summary */}
        {offers.some((o) => !o.hidden) && (
          <div className={styles.summaryCard}>
            <p className={styles.summaryTitle}>Resumen</p>
            <div style={{ overflowX: "auto" }}>
              <table className={styles.summaryTable}>
                <thead>
                  <tr>
                    <th>Oferta</th><th>Precio</th><th>Costos</th>
                    <th>CPA BE disponible</th><th>Objetivo</th><th>Ganancia (ARS)</th><th>Margen</th>
                  </tr>
                </thead>
                <tbody>
                  {offers.filter((o) => !o.hidden).map((offer) => {
                    const c          = calcOffer({ offer, settings, baseFeeKey, cuotasKey, cryptoRate, fixedCosts });
                    const objetivo   = Number(offer.cpa_be_target) || 0;
                    const cpaBE      = cpaUnit === "ars" ? c.cpaBeARS : c.cpaBeUSD;
                    const ok         = objetivo > 0 && c.cpaBeUSD !== null && c.cpaBeUSD >= objetivo;
                    const fmtCPA     = cpaUnit === "ars" ? fmt : fmtUSD;
                    const objARS     = objetivo > 0 && cryptoRate > 0 ? objetivo * cryptoRate : 0;
                    const netProfit  = c.disponible - objARS;
                    const netMargin  = c.salePrice > 0 ? (netProfit / c.salePrice * 100) : 0;
                    return (
                      <tr key={offer.id}>
                        <td><strong style={{ color: "var(--text-bright)" }}>{offer.name}</strong><br /><small style={{ color: "var(--text-muted)" }}>{offer.quantity_label}</small></td>
                        <td style={{ color: "var(--text-bright)" }}>{fmt(c.salePrice)}</td>
                        <td>{fmt(c.totalCosts)}</td>
                        <td><strong style={{ color: objetivo > 0 ? (ok ? "var(--success)" : "var(--danger)") : "var(--text-mid)" }}>{cpaBE === null ? "—" : fmtCPA(cpaBE)}</strong></td>
                        <td>{objetivo > 0 ? fmtUSD(objetivo) : <span style={{ color: "var(--text-muted)" }}>—</span>}</td>
                        <td><strong style={{ color: netProfit >= 0 ? "var(--success)" : "var(--danger)" }}>{fmt(netProfit)}</strong></td>
                        <td style={{ color: netMargin >= 0 ? "var(--text-mid)" : "var(--danger)" }}>{netMargin.toFixed(1)}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
