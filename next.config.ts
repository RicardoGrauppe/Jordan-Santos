import type { NextConfig } from "next";
import { networkInterfaces } from "node:os";

/*
 * Origens de DESENVOLVIMENTO liberadas, pra abrir o app no celular pelo IP da
 * rede local (http://192.168.x.x:3100).
 *
 * Sem isto o Next atende o HTML e os chunks normalmente, mas o socket de HMR
 * é recusado por ser outra origem, e no Turbopack é ele quem termina de subir
 * o app: o resultado é uma página que PARECE certa e não reage a nada. O
 * sintoma clássico é o formulário de login virar envio nativo (`GET /entrar?`)
 * em vez de chamar a API.
 *
 * Os IPs são lidos da máquina em vez de escritos à mão porque o roteador troca
 * o endereço de vez em quando, e um IP fixo aqui quebraria calado de novo.
 * Vale só em `next dev`; no build isto é ignorado.
 */
function ipsDaRedeLocal(): string[] {
  const achados: string[] = [];
  for (const interfaces of Object.values(networkInterfaces())) {
    for (const i of interfaces ?? []) {
      if (i.family === "IPv4" && !i.internal) achados.push(i.address);
    }
  }
  return achados;
}

const nextConfig: NextConfig = {
  allowedDevOrigins: ipsDaRedeLocal(),

  /*
   * O gerador de PDF lê arquivos do disco em tempo de execução: o template
   * vetorial, o mapa de coordenadas e as quatro Roboto que o pdfmake embute.
   * O Next só empacota o que enxerga em `import`, então sem isto o deploy sobe
   * sem esses arquivos e a geração do contrato quebra EM PRODUÇÃO, passando
   * limpa no dev (onde o disco é o repositório).
   */
  outputFileTracingIncludes: {
    "/api/**": ["./src/lib/contrato-pdf/**/*"],
  },

  /* pdfmake e pdf-lib são de Node, não de browser: fora do bundle do servidor
     pra o Next não tentar transformá-los. */
  serverExternalPackages: ["pdfmake", "pdf-lib"],
};

export default nextConfig;
