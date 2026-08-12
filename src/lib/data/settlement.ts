import type { Db, ExpenseCategory, PartnerKind } from "./types";

// Cálculo do acerto (SPEC §7.2). Função pura sobre o Db — usada pela
// projeção ao vivo do /app/financeiro, pela prévia e pelo fechamento.

export type SettlementLineCalc = {
  partner_id: string;
  partner_name: string;
  kind: PartnerKind;
  percent: number | null;
  base_amount: number;
  withdrawals_total: number;
  final_amount: number;
};

export type SettlementCalc = {
  point_id: string;
  period_start: string;
  period_end: string;
  cash_in: number;
  cash_from_sales: number; // à vista (cash+pix) no período
  cash_from_receipts: number; // fiado recebido no período
  gross_sales: number;
  expenses_total: number;
  expenses_by_category: Record<ExpenseCategory, number>;
  landowner_payout: number;
  landowner_name: string | null;
  landowner_model: "revenue_pct" | "fixed" | null;
  profit_pool: number;
  pending_receivable: number; // fiado do período ainda não pago (FIFO)
  lines: SettlementLineCalc[];
  percent_sum: number; // Σ percent dos sócios (aviso se ≠ 100)
};

function inPeriod(dateIso: string, start: string, end: string): boolean {
  return dateIso > start && dateIso <= end;
}

/** Início do período aberto: period_end do último settlement do ponto, ou primeira movimentação. */
export function openPeriodStart(db: Db, pointId: string): string {
  const settlements = db.settlements
    .filter((s) => s.point_id === pointId)
    .sort((a, b) => a.period_end.localeCompare(b.period_end));
  const last = settlements[settlements.length - 1];
  if (last) return last.period_end;

  const firstDates = [
    ...db.sales.filter((s) => s.point_id === pointId).map((s) => s.created_at),
    ...db.expenses.filter((e) => e.point_id === pointId).map((e) => e.spent_at),
    ...db.receipts.filter((r) => r.point_id === pointId).map((r) => r.received_at),
    ...db.withdrawals.filter((w) => w.point_id === pointId).map((w) => w.withdrawn_at),
  ].sort();
  const first = firstDates[0];
  // exclusivo no início (inPeriod usa >): recua 1ms para incluir a primeira movimentação
  if (first) return new Date(new Date(first).getTime() - 1).toISOString();
  return new Date(0).toISOString();
}

export function computeSettlement(
  db: Db,
  pointId: string,
  periodStart: string,
  periodEnd: string
): SettlementCalc {
  const sales = db.sales.filter(
    (s) =>
      s.point_id === pointId &&
      s.status === "active" &&
      inPeriod(s.created_at, periodStart, periodEnd)
  );
  const saleIds = new Set(sales.map((s) => s.id));

  let cashFromSales = 0;
  let creditInPeriod = 0;
  for (const p of db.sale_payments) {
    if (!saleIds.has(p.sale_id)) continue;
    if (p.method === "credit") creditInPeriod += p.amount;
    else cashFromSales += p.amount;
  }

  const receiptsInPeriod = db.receipts.filter(
    (r) =>
      r.point_id === pointId &&
      r.status === "active" &&
      inPeriod(r.received_at, periodStart, periodEnd)
  );
  const cashFromReceipts = receiptsInPeriod.reduce((s, r) => s + r.amount, 0);

  const cashIn = cashFromSales + cashFromReceipts;
  const grossSales = sales.reduce((s, v) => s + v.total, 0);

  const expensesByCategory: Record<ExpenseCategory, number> = {
    diesel: 0,
    part_service: 0,
    labor: 0,
    freight: 0,
    other: 0,
  };
  let expensesTotal = 0;
  for (const e of db.expenses) {
    if (
      e.point_id !== pointId ||
      e.status !== "active" ||
      !inPeriod(e.spent_at, periodStart, periodEnd)
    )
      continue;
    expensesTotal += e.amount;
    expensesByCategory[e.category] += e.amount;
  }

  // landowner (P2): % da receita bruta OU valor fixo por fechamento
  const landowner = db.partners.find(
    (p) => p.point_id === pointId && p.kind === "landowner"
  );
  let landownerPayout = 0;
  if (landowner?.landowner_model === "revenue_pct") {
    // landowner_value = pct*100 (10,00% → 1000)
    landownerPayout = Math.round((grossSales * (landowner.landowner_value ?? 0)) / 10000);
  } else if (landowner?.landowner_model === "fixed") {
    landownerPayout = landowner.landowner_value ?? 0;
  }

  const profitPool = cashIn - expensesTotal - landownerPayout;

  // fiado do período ainda não pago: aloca recebimentos do ponto (todos os
  // tempos) ao fiado mais antigo primeiro (FIFO) e soma o que sobrou em
  // aberto dentro do período.
  const pendingReceivable = pendingCreditInPeriod(
    db,
    pointId,
    periodStart,
    periodEnd
  );

  const partners = db.partners.filter(
    (p) => p.point_id === pointId && p.kind === "partner"
  );
  const percentSum = partners.reduce((s, p) => s + (p.percent ?? 0), 0);

  const lines: SettlementLineCalc[] = partners.map((partner) => {
    const base = Math.round((profitPool * (partner.percent ?? 0)) / 100);
    const withdrawals = db.withdrawals
      .filter(
        (w) =>
          w.partner_id === partner.id &&
          w.status === "active" &&
          inPeriod(w.withdrawn_at, periodStart, periodEnd)
      )
      .reduce((s, w) => s + w.amount, 0);
    return {
      partner_id: partner.id,
      partner_name: partner.name,
      kind: "partner" as const,
      percent: partner.percent,
      base_amount: base,
      withdrawals_total: withdrawals,
      final_amount: base - withdrawals,
    };
  });

  if (landowner) {
    lines.push({
      partner_id: landowner.id,
      partner_name: landowner.name,
      kind: "landowner",
      percent: null,
      base_amount: landownerPayout,
      withdrawals_total: 0,
      final_amount: landownerPayout,
    });
  }

  return {
    point_id: pointId,
    period_start: periodStart,
    period_end: periodEnd,
    cash_in: cashIn,
    cash_from_sales: cashFromSales,
    cash_from_receipts: cashFromReceipts,
    gross_sales: grossSales,
    expenses_total: expensesTotal,
    expenses_by_category: expensesByCategory,
    landowner_payout: landownerPayout,
    landowner_name: landowner?.name ?? null,
    landowner_model: landowner?.landowner_model ?? null,
    profit_pool: profitPool,
    pending_receivable: pendingReceivable,
    lines,
    percent_sum: percentSum,
  };
}

/** Fiado gerado no período e ainda em aberto, com alocação FIFO dos recebimentos do ponto. */
function pendingCreditInPeriod(
  db: Db,
  pointId: string,
  periodStart: string,
  periodEnd: string
): number {
  // todas as linhas de fiado do ponto até o fim do período, em ordem cronológica
  const creditEntries: Array<{ at: string; amount: number }> = [];
  for (const sale of db.sales) {
    if (sale.point_id !== pointId || sale.status !== "active") continue;
    if (sale.created_at > periodEnd) continue;
    for (const p of db.sale_payments) {
      if (p.sale_id !== sale.id || p.method !== "credit") continue;
      creditEntries.push({ at: sale.created_at, amount: p.amount });
    }
  }
  creditEntries.sort((a, b) => a.at.localeCompare(b.at));

  let received = db.receipts
    .filter(
      (r) =>
        r.point_id === pointId &&
        r.status === "active" &&
        r.received_at <= periodEnd
    )
    .reduce((s, r) => s + r.amount, 0);

  let pending = 0;
  for (const entry of creditEntries) {
    const paid = Math.min(entry.amount, received);
    received -= paid;
    const open = entry.amount - paid;
    if (open > 0 && inPeriod(entry.at, periodStart, periodEnd)) {
      pending += open;
    }
  }
  return pending;
}

/** §7.3: um lançamento não pode ser cancelado se um settlement fechado cobre sua data. */
export function isCoveredBySettlement(
  db: Db,
  pointId: string,
  dateIso: string
): boolean {
  return db.settlements.some(
    (s) =>
      s.point_id === pointId &&
      dateIso > s.period_start &&
      dateIso <= s.period_end
  );
}
