import "./globals.css";
import { Toaster } from "sonner";

export const metadata = {
  title: {
    default: "Real Ecom Academy — Herramientas",
    template: "%s · Real Ecom Academy",
  },
  description: "Portal de herramientas y automatizaciones de Real Ecom Academy.",
  icons: { icon: "/logos/ico.png" },
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body style={{ background: "#080b18" }}>
        {children}
        <Toaster position="top-right" richColors theme="dark" />
      </body>
    </html>
  );
}
