/* esqueleto no instante do toque, enquanto a página chega (ver SkeletonPaginas) */
import { SkPaginaLista } from "@/components/SkeletonPaginas";

export default function Carregando() {
  return <SkPaginaLista largura={760} />;
}
