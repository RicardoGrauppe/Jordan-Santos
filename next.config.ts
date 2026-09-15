import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
