import "./globals.css";
import { Toaster } from "sonner";

export const metadata = {
  title: "Real Ecom Calculator",
  description: "Calculadora de rentabilidad para MercadoPago",
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
