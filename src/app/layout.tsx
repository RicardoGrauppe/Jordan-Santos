import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { ProvedorConfirmacao } from "@/components/ModalConfirmar";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--fonte-inter", display: "swap" });

/*
  Metadados que valem pro SITE INTEIRO, inclusive as telas que o casal abre.

  O que é do APP (cara de aplicativo salvo na tela de início e trava de zoom)
  NÃO mora aqui: mora em src/app/painel/layout.tsx. No original o `travarZoom()`
  era ligado por tela e desligado ao entrar no app, de propósito, pra não
  atrapalhar quem precisa dar zoom. Uma trava global alcançaria a proposta, o
  cadastro e a tela de assinar, que o original nunca travou.
*/
export const metadata: Metadata = {
  title: "Estúdio",
  description: "Painel do fotógrafo: clientes, contrato, assinatura e entrega.",
  applicationName: "Estúdio",
  icons: {
    icon: [
      { url: "/img/icone-32.png", sizes: "32x32", type: "image/png" },
      { url: "/img/icone-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/img/icone-180.png", sizes: "180x180", type: "image/png" }],
  },
};

/* viewport-fit=cover é o que faz env(safe-area-inset-*) devolver valor no
   iPhone; sem isso a barra inferior fica embaixo da barrinha de home. Vale pro
   site todo porque não custa nada a quem não usa. A trava de zoom, essa sim,
   fica só no painel. */
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
