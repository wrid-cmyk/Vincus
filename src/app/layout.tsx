import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Vincus — WRID",
  description: "Plataforma interna de gestão e decisão da WRID.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
