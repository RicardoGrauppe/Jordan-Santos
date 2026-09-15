import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { ProvedorConfirmacao } from "@/components/ModalConfirmar";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--fonte-inter", display: "swap" });

export const metadata: Metadata = {
  title: "Estúdio",
  description: "Painel do fotógrafo: clientes, contrato, assinatura e entrega.",
};

/* viewport-fit=cover é o que faz env(safe-area-inset-*) devolver valor no
   iPhone; sem isso a barra inferior fica embaixo da barrinha de home. */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={inter.variable}>
      <body>
        <ProvedorConfirmacao>{children}</ProvedorConfirmacao>
      </body>
    </html>
  );
}
