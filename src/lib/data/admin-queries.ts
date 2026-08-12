import { readDb } from "./db";
import { clientBalance } from "./queries";
import { computeSettlement, openPeriodStart, isCoveredBySettlement } from "./settlement";
import { createClient } from "@/lib/supabase/server";
import type {
  Client,
  Db,
  ExpenseCategory,
  PaymentMethod,
  Point,
  Sale,
  SalePayment,
  Settlement,
  SettlementLine,
} from "./types";

// ============================================================
// Contas a receber / vencidos
// ============================================================

const OVERDUE_DAYS = 30; // premissa da demo: fiado com mais de 30 dias = vencido

/**
 * Fiado em aberto do cliente com idade, por alocação FIFO dos recebimentos
 * (paga-se primeiro o fiado mais antigo). Retorna o total vencido (> 30 dias).
 */
export function overdueBalance(db: Db, clientId: string): number {
  const creditEntries: Array<{ at: string; amount: number }> = [];
  for (const sale of db.sales) {
    if (sale.client_id !== clientId || sale.status !== "active") continue;
    for (const p of db.sale_payments) {
      if (p.sale_id !== sale.id || p.method !== "credit") continue;
      creditEntries.push({ at: sale.created_at, amount: p.amount });
    }
  }
  creditEntries.sort((a, b) => a.at.localeCompare(b.at));

  let received = db.receipts
    .filter((r) => r.client_id === clientId && r.status === "active")
    .reduce((s, r) => s + r.amount, 0);

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - OVERDUE_DAYS);
  const cutoffIso = cutoff.toISOString();

  let overdue = 0;
  for (const entry of creditEntries) {
    const paid = Math.min(entry.amount, received);
    received -= paid;
    const open = entry.amount - paid;
    if (open > 0 && entry.at < cutoffIso) overdue += open;
  }
  return overdue;
}

export type ClientRow = Client & { balance: number; overdue: number };

export async function listClientsAdmin(): Promise<ClientRow[]> {
  const db = await readDb();
  return db.clients
    .map((c) => ({
      ...c,
      balance: clientBalance(db, c.id),
      overdue: overdueBalance(db, c.id),
    }))
    .sort((a, b) => b.balance - a.balance || a.name.localeCompare(b.name, "pt-BR"));
}

// ============================================================
// Extrato corrido do cliente
// ============================================================

export type StatementRow = {
  at: string;
  kind: "sale" | "receipt";
  description: string;
  pointName: string;
  saleTotal: number | null; // total da venda (informativo)
  delta: number; // + fiado gerado, − recebimento
  balance: number; // saldo acumulado após a linha
};

export async function clientStatement(
  clientId: string,
  from?: string,
  to?: string
): Promise<{ client: Client; rows: StatementRow[]; balance: number } | null> {
  const db = await readDb();
  const client = db.clients.find((c) => c.id === clientId);
  if (!client) return null;

  const pointName = (id: string) =>
    db.points.find((p) => p.id === id)?.name ?? "—";

  const events: Array<Omit<StatementRow, "balance">> = [];

  for (const sale of db.sales) {
    if (sale.client_id !== clientId || sale.status !== "active") continue;
    const product = db.products.find((p) => p.id === sale.product_id);
    const credit = db.sale_payments
      .filter((p) => p.sale_id === sale.id && p.method === "credit")
      .reduce((s, p) => s + p.amount, 0);
    events.push({
      at: sale.created_at,
      kind: "sale",
      description: `Venda ${sale.receipt_no} — ${product?.name ?? ""} ${sale.qty_m3} m³${credit > 0 ? (credit < sale.total ? " (parte fiado)" : " (fiado)") : " (à vista)"}`,
      pointName: pointName(sale.point_id),
      saleTotal: sale.total,
      delta: credit,
    });
  }

  const methodLabel = { cash: "dinheiro", pix: "PIX", transfer: "transferência" };
  for (const r of db.receipts) {
    if (r.client_id !== clientId || r.status !== "active") continue;
    events.push({
      at: r.received_at,
      kind: "receipt",
      description: `Recebimento (${methodLabel[r.method]})${r.note ? ` — ${r.note}` : ""}`,
      pointName: pointName(r.point_id),
      saleTotal: null,
      delta: -r.amount,
    });
  }

  events.sort((a, b) => a.at.localeCompare(b.at));

  let balance = 0;
  const allRows: StatementRow[] = events.map((e) => {
    balance += e.delta;
    return { ...e, balance };
  });

  const rows = allRows.filter(
    (r) => (!from || r.at >= from) && (!to || r.at <= to)
  );

  return { client, rows, balance };
}

// ============================================================
// Vendas (lista com filtros + detalhe)
// ============================================================

export type SalesFilter = {
  pointId?: string;
  clientId?: string;
  method?: PaymentMethod;
  from?: string; // YYYY-MM-DD
  to?: string; // YYYY-MM-DD
};

export type SaleRow = Sale & {
  pointName: string;
  productName: string;
  clientName: string;
  payments: SalePayment[];
  canCancel: boolean;
  photoSignedUrl: string | null;
};

export async function listSalesAdmin(filter: SalesFilter): Promise<SaleRow[]> {
  const db = await readDb();
  const filtered = db.sales
    .filter((s) => {
      if (filter.pointId && s.point_id !== filter.pointId) return false;
      if (filter.clientId && s.client_id !== filter.clientId) return false;
      if (filter.from && s.created_at < `${filter.from}T00:00:00`) return false;
      if (filter.to && s.created_at > `${filter.to}T23:59:59.999Z`) return false;
      if (filter.method) {
        const has = db.sale_payments.some(
          (p) => p.sale_id === s.id && p.method === filter.method
        );
        if (!has) return false;
      }
      return true;
    })
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 300);

  const supabase = await createClient();
  const rows = await Promise.all(
    filtered.map(async (s) => {
      let photoSignedUrl: string | null = null;
      if (s.photo_url) {
        const { data } = await supabase.storage
          .from("photos")
          .createSignedUrl(s.photo_url, 60 * 60);
        photoSignedUrl = data?.signedUrl ?? null;
      }
      return {
        ...s,
        pointName: db.points.find((p) => p.id === s.point_id)?.name ?? "—",
        productName: db.products.find((p) => p.id === s.product_id)?.name ?? "—",
        clientName: s.client_id
          ? db.clients.find((c) => c.id === s.client_id)?.name ?? "—"
          : "Venda avulsa",
        payments: db.sale_payments.filter((p) => p.sale_id === s.id),
        canCancel:
          s.status === "active" && !isCoveredBySettlement(db, s.point_id, s.created_at),
        photoSignedUrl,
      };
    })
  );
  return rows;
}

// ============================================================
// Gastos e retiradas (listas)
// ============================================================

export async function listExpensesAdmin(pointId?: string) {
  const db = await readDb();
  return db.expenses
    .filter((e) => !pointId || e.point_id === pointId)
    .sort((a, b) => b.spent_at.localeCompare(a.spent_at))
    .slice(0, 200)
    .map((e) => ({
      ...e,
      pointName: db.points.find((p) => p.id === e.point_id)?.name ?? "—",
      machineName: e.machine_id
        ? db.machines.find((m) => m.id === e.machine_id)?.name ?? null
        : null,
      canCancel:
        e.status === "active" && !isCoveredBySettlement(db, e.point_id, e.spent_at),
    }));
}

export async function listWithdrawalsAdmin(pointId?: string) {
  const db = await readDb();
  return db.withdrawals
    .filter((w) => !pointId || w.point_id === pointId)
    .sort((a, b) => b.withdrawn_at.localeCompare(a.withdrawn_at))
    .slice(0, 200)
    .map((w) => ({
      ...w,
      pointName: db.points.find((p) => p.id === w.point_id)?.name ?? "—",
      partnerName: db.partners.find((p) => p.id === w.partner_id)?.name ?? "—",
      canCancel:
        w.status === "active" && !isCoveredBySettlement(db, w.point_id, w.withdrawn_at),
    }));
}

// ============================================================
// Financeiro (período aberto + histórico)
// ============================================================

export async function openPeriodCalc(pointId: string) {
  const db = await readDb();
  const start = openPeriodStart(db, pointId);
  return computeSettlement(db, pointId, start, new Date().toISOString());
}

export type SettlementWithLines = Settlement & {
  pointName: string;
  lines: SettlementLine[];
};

export async function listSettlements(pointId?: string): Promise<SettlementWithLines[]> {
  const db = await readDb();
  return db.settlements
    .filter((s) => !pointId || s.point_id === pointId)
    .sort((a, b) => b.closed_at.localeCompare(a.closed_at))
    .map((s) => ({
      ...s,
      pointName: db.points.find((p) => p.id === s.point_id)?.name ?? "—",
      lines: db.settlement_lines.filter((l) => l.settlement_id === s.id),
    }));
}

export async function getSettlement(id: string): Promise<SettlementWithLines | null> {
  const db = await readDb();
  const s = db.settlements.find((x) => x.id === id);
  if (!s) return null;
  return {
    ...s,
    pointName: db.points.find((p) => p.id === s.point_id)?.name ?? "—",
    lines: db.settlement_lines.filter((l) => l.settlement_id === s.id),
  };
}

// ============================================================
// Dashboard
// ============================================================

export type PointKpi = {
  point: Point;
  todayCents: number;
  todayM3: number;
  monthCents: number;
  monthM3: number;
  producedMonthM3: number;
  soldMonthM3: number;
  deviationPct: number | null; // (produzido − vendido) / produzido
};

export type DashboardData = {
  points: PointKpi[];
  receivableTotal: number;
  overdueTotal: number;
  monthExpenses: number;
  monthExpensesByCategory: Record<ExpenseCategory, number>;
  monthWithdrawals: number;
  attention: string[];
};

export async function dashboardData(): Promise<DashboardData> {
  const db = await readDb();
  const now = new Date();
  const todayKey = now.toDateString();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const points: PointKpi[] = db.points.map((point) => {
    let todayCents = 0,
      todayM3 = 0,
      monthCents = 0,
      monthM3 = 0;
    for (const s of db.sales) {
      if (s.point_id !== point.id || s.status !== "active") continue;
      if (s.created_at >= monthStart) {
        monthCents += s.total;
        monthM3 += s.qty_m3;
      }
      if (new Date(s.created_at).toDateString() === todayKey) {
        todayCents += s.total;
        todayM3 += s.qty_m3;
      }
    }
    const producedMonthM3 = db.production_logs
      .filter((l) => l.point_id === point.id && l.log_date.startsWith(monthKey))
      .reduce((s, l) => s + l.m3, 0);
    const deviationPct =
      producedMonthM3 > 0
        ? ((producedMonthM3 - monthM3) / producedMonthM3) * 100
        : null;
    return {
      point,
      todayCents,
      todayM3,
      monthCents,
      monthM3,
      producedMonthM3: Math.round(producedMonthM3 * 10) / 10,
      soldMonthM3: Math.round(monthM3 * 10) / 10,
      deviationPct,
    };
  });

  let receivableTotal = 0;
  let overdueTotal = 0;
  for (const c of db.clients) {
    const b = clientBalance(db, c.id);
    if (b > 0) receivableTotal += b;
    overdueTotal += overdueBalance(db, c.id);
  }

  const monthExpensesByCategory: Record<ExpenseCategory, number> = {
    diesel: 0,
    part_service: 0,
    labor: 0,
    freight: 0,
    other: 0,
  };
  let monthExpenses = 0;
  for (const e of db.expenses) {
    if (e.status !== "active" || e.spent_at < monthStart) continue;
    monthExpenses += e.amount;
    monthExpensesByCategory[e.category] += e.amount;
  }

  const monthWithdrawals = db.withdrawals
    .filter((w) => w.status === "active" && w.withdrawn_at >= monthStart)
    .reduce((s, w) => s + w.amount, 0);

  // "Atenção hoje": alertas derivados
  const attention: string[] = [];
  for (const k of points) {
    if (k.deviationPct !== null && Math.abs(k.deviationPct) > 5) {
      attention.push(
        `${k.point.name}: produção e venda do mês divergem ${k.deviationPct.toFixed(0)}% — conferir com o operador.`
      );
    }
  }
  for (const c of db.clients) {
    if (!c.credit_enabled || c.credit_limit <= 0) continue;
    const b = clientBalance(db, c.id);
    if (b > c.credit_limit) {
      attention.push(`${c.name} está acima do limite de crédito.`);
    }
  }
  if (overdueTotal > 0) {
    attention.push(`Há fiado vencido há mais de ${OVERDUE_DAYS} dias em aberto.`);
  }

  return {
    points,
    receivableTotal,
    overdueTotal,
    monthExpenses,
    monthExpensesByCategory,
    monthWithdrawals,
    attention,
  };
}
