import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Leads Dashboard",
  description: "Panel de leads — seguridad privada",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
