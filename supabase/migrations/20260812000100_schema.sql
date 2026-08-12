-- MineraPonto — F1: schema completo (SPEC-MVP.md §6)
-- Multi-tenant desde já (company_id em tudo; a demo usa 1 empresa).
-- Dinheiro em centavos (bigint). Timestamps sempre timestamptz.

-- ============================================================
-- Empresa e perfis
-- ============================================================

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null
);

-- perfil espelha auth.users
create table public.profiles (
  id uuid primary key references auth.users (id),
  created_at timestamptz not null default now(),
  company_id uuid not null references public.companies (id),
  name text not null,
  role text not null check (role in ('owner', 'office', 'field'))
);

-- ============================================================
-- Cadastros
-- ============================================================

create table public.points (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  company_id uuid not null references public.companies (id),
  name text not null,
  city text
);

-- sócios e dono do terreno, por ponto
create table public.partners (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  company_id uuid not null references public.companies (id),
  point_id uuid not null references public.points (id),
  name text not null,
  kind text not null check (kind in ('partner', 'landowner')),
  percent numeric(5, 2),           -- para kind=partner (participação no lucro)
  landowner_model text check (landowner_model in ('revenue_pct', 'fixed')),
  landowner_value bigint           -- pct*100 (ex.: 10.00% = 1000) ou centavos fixos
);

create table public.machines (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  company_id uuid not null references public.companies (id),
  point_id uuid not null references public.points (id),
  name text not null
);

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  company_id uuid not null references public.companies (id),
  name text not null,
  phone text,
  doc text,
  credit_enabled boolean not null default false,
  credit_limit bigint not null default 0   -- centavos; 0 = sem limite definido
);

create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  company_id uuid not null references public.companies (id),
  client_id uuid references public.clients (id),   -- nullable
  plate text,
  label text not null,
  capacity_m3 numeric(6, 2) not null
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  company_id uuid not null references public.companies (id),
  point_id uuid not null references public.points (id),
  name text not null,
  price_per_m3 bigint not null    -- centavos
);

-- ============================================================
-- Transacionais (nunca deletar: cancelamento via status + motivo)
-- ============================================================

create table public.sales (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  company_id uuid not null references public.companies (id),
  point_id uuid not null references public.points (id),
  product_id uuid not null references public.products (id),
  client_id uuid references public.clients (id),   -- null = venda avulsa
  qty_m3 numeric(8, 2) not null,
  unit_price bigint not null,                      -- snapshot do preço no momento
  discount_pct numeric(5, 2) not null default 0,
  total bigint not null,                           -- calculado e gravado
  receipt_no text not null,                        -- ex.: 'PA1-000124' (sequência por ponto — §7.4)
  status text not null default 'active' check (status in ('active', 'canceled')),
  cancel_reason text,
  canceled_at timestamptz,
  canceled_by uuid references public.profiles (id),
  photo_url text,
  gps_lat numeric(9, 6),
  gps_lng numeric(9, 6),
  created_by uuid not null references public.profiles (id),
  unique (point_id, receipt_no)
);

-- pagamento misto: 1 venda → N linhas (ex.: cash 20000 + credit 80000)
create table public.sale_payments (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  sale_id uuid not null references public.sales (id) on delete cascade,
  method text not null check (method in ('cash', 'pix', 'credit')),
  amount bigint not null check (amount > 0)
);

-- baixa de fiado; point_id obrigatório para o caixa do acerto ser por ponto
create table public.receipts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  company_id uuid not null references public.companies (id),
  point_id uuid not null references public.points (id),
  client_id uuid not null references public.clients (id),
  amount bigint not null,
  method text not null check (method in ('cash', 'pix', 'transfer')),
  received_at timestamptz not null default now(),
  note text,
  created_by uuid not null references public.profiles (id),
  status text not null default 'active' check (status in ('active', 'canceled')),
  cancel_reason text
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  company_id uuid not null references public.companies (id),
  point_id uuid not null references public.points (id),
  machine_id uuid references public.machines (id),   -- nullable
  category text not null check (category in ('diesel', 'part_service', 'labor', 'freight', 'other')),
  amount bigint not null,
  liters numeric(8, 2),
  note text,
  photo_url text,
  spent_at timestamptz not null default now(),
  created_by uuid not null references public.profiles (id),
  status text not null default 'active' check (status in ('active', 'canceled')),
  cancel_reason text
);

-- retirada/vale de sócio
create table public.withdrawals (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  company_id uuid not null references public.companies (id),
  point_id uuid not null references public.points (id),
  partner_id uuid not null references public.partners (id),
  amount bigint not null,
  note text,
  withdrawn_at timestamptz not null default now(),
  created_by uuid not null references public.profiles (id),
  status text not null default 'active' check (status in ('active', 'canceled')),
  cancel_reason text
);

create table public.production_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  company_id uuid not null references public.companies (id),
  point_id uuid not null references public.points (id),
  machine_id uuid references public.machines (id),   -- nullable
  log_date date not null,
  trips int,
  m3 numeric(8, 2) not null,   -- m3 informado ou trips*fator
  created_by uuid not null references public.profiles (id)
);

-- ============================================================
-- Acerto (settlement fechado = snapshot imutável)
-- ============================================================

create table public.settlements (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  company_id uuid not null references public.companies (id),
  point_id uuid not null references public.points (id),
  period_start timestamptz not null,
  period_end timestamptz not null,
  closed_at timestamptz not null default now(),
  closed_by uuid not null references public.profiles (id),
  cash_in bigint not null,
  gross_sales bigint not null,
  expenses_total bigint not null,
  landowner_payout bigint not null,
  profit_pool bigint not null,
  snapshot jsonb not null      -- todos os números e linhas, para auditoria
);

create table public.settlement_lines (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  settlement_id uuid not null references public.settlements (id) on delete cascade,
  partner_id uuid not null references public.partners (id),
  partner_name text not null,
  kind text not null,
  base_amount bigint not null,                     -- fatia do lucro (ou payout do landowner)
  withdrawals_total bigint not null default 0,
  final_amount bigint not null                     -- base - retiradas
);

-- contador de recibo por ponto (select ... for update na transação da venda — §7.4)
create table public.point_counters (
  point_id uuid primary key references public.points (id),
  prefix text not null,
  next_no int not null default 1
);

-- ============================================================
-- Índices para as consultas do período/extrato
-- ============================================================

create index sales_point_created_idx on public.sales (point_id, created_at);
create index sales_client_idx on public.sales (client_id);
create index sale_payments_sale_idx on public.sale_payments (sale_id);
create index receipts_point_received_idx on public.receipts (point_id, received_at);
create index receipts_client_idx on public.receipts (client_id);
create index expenses_point_spent_idx on public.expenses (point_id, spent_at);
create index withdrawals_point_idx on public.withdrawals (point_id, withdrawn_at);
create index withdrawals_partner_idx on public.withdrawals (partner_id);
create index production_logs_point_date_idx on public.production_logs (point_id, log_date);
create index settlements_point_idx on public.settlements (point_id, closed_at);
create index settlement_lines_settlement_idx on public.settlement_lines (settlement_id);

-- ============================================================
-- Helper: company do usuário logado (security definer evita
-- recursão de RLS ao consultar profiles dentro de policies)
-- ============================================================

create or replace function public.current_company_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select company_id from public.profiles where id = auth.uid()
$$;

revoke all on function public.current_company_id() from public;
grant execute on function public.current_company_id() to authenticated;

-- ============================================================
-- View derivada: saldo devedor do cliente (SPEC §6)
-- client_balance = Σ sale_payments.credit de vendas active − Σ receipts.active
-- (security_invoker: RLS das tabelas base se aplica a quem consulta)
-- ============================================================

create view public.client_balances
with (security_invoker = on) as
select
  c.id as client_id,
  c.company_id,
  coalesce(cr.credit_total, 0) - coalesce(rc.received_total, 0) as balance
from public.clients c
left join (
  select s.client_id, sum(sp.amount) as credit_total
  from public.sales s
  join public.sale_payments sp on sp.sale_id = s.id
  where s.status = 'active' and sp.method = 'credit' and s.client_id is not null
  group by s.client_id
) cr on cr.client_id = c.id
left join (
  select r.client_id, sum(r.amount) as received_total
  from public.receipts r
  where r.status = 'active'
  group by r.client_id
) rc on rc.client_id = c.id;

-- Obs.: "caixa do ponto no período" é consulta parametrizada por datas,
-- implementada nas queries do app (não como view).
