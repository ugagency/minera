-- MineraPonto — F1: Storage (SPEC §6)
-- Bucket `photos` privado; leitura pública só via URLs assinadas (geradas no servidor).
-- Caminho dos objetos: {company_id}/... — a policy amarra o acesso à empresa do usuário.

insert into storage.buckets (id, name, public)
values ('photos', 'photos', false)
on conflict (id) do nothing;

create policy "photos_company_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'photos'
    and (storage.foldername(name))[1] = public.current_company_id()::text
  );

create policy "photos_company_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'photos'
    and (storage.foldername(name))[1] = public.current_company_id()::text
  );
