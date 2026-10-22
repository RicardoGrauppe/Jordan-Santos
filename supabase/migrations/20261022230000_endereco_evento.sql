/*
  Endereço do evento, separado do "Local do evento" (22/10/2026).

  O local é o nome do espaço ("Villa Bisutti"); o endereço é onde ele fica,
  pra quem vai fotografar chegar. Opcional no /cadastro, editável na ficha.
  Não entra no contrato (nem no snapshot): o contrato continua citando o local.
*/
alter table public.clientes
  add column if not exists endereco_evento text;
