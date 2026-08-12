-- MineraPonto — F1: RLS (SPEC §6)
-- Habilitar em todas as tabelas; policy única por tabela:
-- company_id = company do usuário logado (via helper security definer).
-- Tabelas sem company_id (sale_payments, settlement_lines, point_counters)
-- herdam o escopo pela tabela-pai.

-- ============================================================
-- Habilitar RLS
-- ============================================================

alter table public.companies enable row level security;
alter table public.profiles enable row level security;
alter table public.points enable row level security;
alter table public.partners enable row level security;
alter table public.machines enable row level security;
alter table public.clients enable row level security;
alter table public.vehicles enable row level security;
alter table public.products enable row level security;
alter table public.sales enable row level security;
alter table public.sale_payments enable row level security;
alter table public.receipts enable row level security;
alter table public.expenses enable row level security;
alter table public.withdrawals enable row level security;
alter table public.production_logs enable row level security;
alter table public.settlements enable row level security;
alter table public.settlement_lines enable row level security;
alter table public.point_counters enable row level security;

-- ============================================================
-- Policies (uma por tabela, escopo = empresa do usuário)
-- ============================================================

create policy "company_scope" on public.companies
  for all to authenticated
  using (id = public.current_company_id())
  with check (id = public.current_company_id());

-- profiles: o próprio usuário sempre enxerga seu perfil (bootstrap do login)
create policy "company_scope" on public.profiles
  for all to authenticated
  using (company_id = public.current_company_id() or id = auth.uid())
  with check (company_id = public.current_company_id() or id = auth.uid());

create policy "company_scope" on public.points
  for all to authenticated
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());

create policy "company_scope" on public.partners
  for all to authenticated
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());

create policy "company_scope" on public.machines
  for all to authenticated
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());

create policy "company_scope" on public.clients
  for all to authenticated
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());

create policy "company_scope" on public.vehicles
  for all to authenticated
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());

create policy "company_scope" on public.products
  for all to authenticated
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());

create policy "company_scope" on public.sales
  for all to authenticated
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());

create policy "company_scope" on public.sale_payments
  for all to authenticated
  using (
    exists (
      select 1 from public.sales s
      where s.id = sale_id and s.company_id = public.current_company_id()
    )
  )
  with check (
    exists (
      select 1 from public.sales s
      where s.id = sale_id and s.company_id = public.current_company_id()
    )
  );

create policy "company_scope" on public.receipts
  for all to authenticated
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());

create policy "company_scope" on public.expenses
  for all to authenticated
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());

create policy "company_scope" on public.withdrawals
  for all to authenticated
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());

create policy "company_scope" on public.production_logs
  for all to authenticated
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());

create policy "company_scope" on public.settlements
  for all to authenticated
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());

create policy "company_scope" on public.settlement_lines
  for all to authenticated
  using (
    exists (
      select 1 from public.settlements st
      where st.id = settlement_id and st.company_id = public.current_company_id()
    )
  )
  with check (
    exists (
      select 1 from public.settlements st
      where st.id = settlement_id and st.company_id = public.current_company_id()
    )
  );

create policy "company_scope" on public.point_counters
  for all to authenticated
  using (
    exists (
      select 1 from public.points p
      where p.id = point_id and p.company_id = public.current_company_id()
    )
  )
  with check (
    exists (
      select 1 from public.points p
      where p.id = point_id and p.company_id = public.current_company_id()
    )
  );

-- Obs.: a página pública do recibo (/r/[saleId], F2) NÃO usa policy anon —
-- é lida no servidor com a service role key, expondo só os campos do recibo.
