/*
  O Formulário virou um tipo de modelo do Ateliê (22/10/2026): a lista mora
  em /painel/atelie e cada um abre em /painel/atelie/formulario/<id>. Este
  endereço fica só pra quem tinha o link salvo.
*/
import { redirect } from "next/navigation";

export default function FormularioAntigo() {
  redirect("/painel/atelie#formularios");
}
