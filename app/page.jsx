import Link from "next/link";
import { Calculator, Clapperboard, ArrowRight, Sparkles } from "lucide-react";
import { TOOLS } from "./tools";
import styles from "./portal.module.css";

// Mapa de iconos disponibles para las tarjetas.
const ICONS = { Calculator, Clapperboard };

export const metadata = {
  title: "Real Ecom Academy — Herramientas",
  description: "Portal de herramientas y automatizaciones de Real Ecom Academy.",
};

export default function PortalPage() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logos/logo.jpg" alt="Real Ecom Academy" className={styles.logo} />
          <span className={styles.badge}>
            <Sparkles size={13} /> Portal de herramientas
          </span>
        </div>
      </header>

      <main className={styles.main}>
        <div className={styles.hero}>
          <h1 className={styles.title}>Herramientas de Real Ecom Academy</h1>
          <p className={styles.subtitle}>
            Todo en un solo lugar. Elegí la herramienta que querés usar para tus automatizaciones.
          </p>
        </div>

        <div className={styles.grid}>
          {TOOLS.map((tool) => {
            const Icon = ICONS[tool.icon] ?? Sparkles;
            const card = (
              <>
                <div className={styles.cardTop}>
                  <div className={styles.iconWrap}>
                    <Icon size={22} />
                  </div>
                  {tool.ready ? (
                    <span className={styles.tag}>{tool.tag}</span>
                  ) : (
                    <span className={`${styles.tag} ${styles.tagSoon}`}>Próximamente</span>
                  )}
                </div>
                <h2 className={styles.cardTitle}>{tool.title}</h2>
                <p className={styles.cardDesc}>{tool.desc}</p>
                <span className={styles.cardCta}>
                  {tool.ready ? "Abrir" : "Pronto"} <ArrowRight size={15} />
                </span>
              </>
            );

            return tool.ready ? (
              <Link key={tool.slug} href={tool.href} className={styles.card}>
                {card}
              </Link>
            ) : (
              <div key={tool.slug} className={`${styles.card} ${styles.cardDisabled}`}>
                {card}
              </div>
            );
          })}
        </div>
      </main>

      <footer className={styles.footer}>
        Real Ecom Academy · {TOOLS.filter((t) => t.ready).length} herramientas activas
      </footer>
    </div>
  );
}
