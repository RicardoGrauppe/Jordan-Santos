/*
  Bucket das fotos da abertura do /cadastro que o fotógrafo envia pelo
  editor de Formulário (22/10/2026).

  Privado de propósito: quem entrega a foto pro casal é a rota
  /api/formulario/fotos/<arquivo>, com a service role. Assim o endereço é o do
  próprio app (o do Storage local é 127.0.0.1, que o celular não alcança) e
  nada fica listável de fora. O servidor já grava webp redimensionado, por
  isso só webp e no máximo 5 MB.
*/
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('formulario-fotos', 'formulario-fotos', false, 5242880, array['image/webp'])
on conflict (id) do nothing;
