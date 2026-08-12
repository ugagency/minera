-- MineraPonto — RPCs para operações que precisam ser atômicas.
-- security invoker (padrão): roda como o usuário autenticado, RLS continua
-- valendo normalmente — a função só agrupa os passos numa única transação.

-- ============================================================
-- create_sale (§7.1 pagamento misto, §7.4 contador de recibo)
-- Aloca o próximo nº de recibo com lock e grava a venda + pagamentos
-- na mesma transação, para nunca haver corrida no contador.
-- ============================================================

create or replace function public.create_sale(
  p_point_id uuid,
  p_product_id uuid,
  p_client_id uuid,
  p_qty_m3 numeric,
  p_unit_price bigint,
  p_total bigint,
  p_photo_url text,
  p_gps_lat numeric,
  p_gps_lng numeric,
  p_payments jsonb
)
returns table (id uuid, receipt_no text)
language plpgsql
as $$
declare
  v_company_id uuid;
  v_prefix text;
  v_no int;
  v_receipt_no text;
  v_sale_id uuid;
  v_payment jsonb;
begin
  select company_id into v_company_id from public.profiles where id = auth.uid();
  if v_company_id is null then
    raise exception 'Perfil não encontrado para o usuário autenticado';
  end if;

  select prefix, next_no into v_prefix, v_no
  from public.point_counters
  where point_id = p_point_id
  for update;

  if not found then
    raise exception 'Ponto sem contador de recibo (point_counters)';
  end if;

  update public.point_counters set next_no = v_no + 1 where point_id = p_point_id;
  v_receipt_no := v_prefix || '-' || lpad(v_no::text, 6, '0');

  insert into public.sales (
    company_id, point_id, product_id, client_id, qty_m3, unit_price,
    discount_pct, total, receipt_no, status, photo_url, gps_lat, gps_lng, created_by
  ) values (
    v_company_id, p_point_id, p_product_id, p_client_id, p_qty_m3, p_unit_price,
    0, p_total, v_receipt_no, 'active', p_photo_url, p_gps_lat, p_gps_lng, auth.uid()
  )
  returning sales.id into v_sale_id;

  for v_payment in select * from jsonb_array_elements(p_payments)
  loop
    insert into public.sale_payments (sale_id, method, amount)
    values (v_sale_id, v_payment->>'method', (v_payment->>'amount')::bigint);
  end loop;

  return query select v_sale_id, v_receipt_no;
end;
$$;

revoke all on function public.create_sale from public;
grant execute on function public.create_sale to authenticated;

-- ============================================================
-- close_settlement (§7.2 passo 8) — grava settlement + settlement_lines
-- juntos; o cálculo em si continua feito em TypeScript (src/lib/data/settlement.ts),
-- esta função só persiste o resultado de forma atômica.
-- ============================================================

create or replace function public.close_settlement(
  p_point_id uuid,
  p_period_start timestamptz,
  p_period_end timestamptz,
  p_cash_in bigint,
  p_gross_sales bigint,
  p_expenses_total bigint,
  p_landowner_payout bigint,
  p_profit_pool bigint,
  p_snapshot jsonb,
  p_lines jsonb
)
returns table (id uuid)
language plpgsql
as $$
declare
  v_company_id uuid;
  v_settlement_id uuid;
  v_line jsonb;
begin
  select company_id into v_company_id from public.profiles where id = auth.uid();
  if v_company_id is null then
    raise exception 'Perfil não encontrado para o usuário autenticado';
  end if;

  insert into public.settlements (
    company_id, point_id, period_start, period_end, closed_by,
    cash_in, gross_sales, expenses_total, landowner_payout, profit_pool, snapshot
  ) values (
    v_company_id, p_point_id, p_period_start, p_period_end, auth.uid(),
    p_cash_in, p_gross_sales, p_expenses_total, p_landowner_payout, p_profit_pool, p_snapshot
  )
  returning settlements.id into v_settlement_id;

  for v_line in select * from jsonb_array_elements(p_lines)
  loop
    insert into public.settlement_lines (
      settlement_id, partner_id, partner_name, kind, base_amount, withdrawals_total, final_amount
    ) values (
      v_settlement_id,
      (v_line->>'partner_id')::uuid,
      v_line->>'partner_name',
      v_line->>'kind',
      (v_line->>'base_amount')::bigint,
      (v_line->>'withdrawals_total')::bigint,
      (v_line->>'final_amount')::bigint
    );
  end loop;

  return query select v_settlement_id;
end;
$$;

revoke all on function public.close_settlement from public;
grant execute on function public.close_settlement to authenticated;
