// Seed de demonstração (SPEC-MVP.md §10) — roda direto contra o Supabase
// real com a service_role key. Idempotente: se a empresa demo já existir
// (checado pelo e-mail do usuário dono), não faz nada e sai.
//
// Uso: npm run seed   (lê .env.local)

import { randomUUID } from "node:crypto";
import { config as loadEnv } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { computeSettlement, openPeriodStart } from "../src/lib/data/settlement";
import type {
  Client,
  Company,
  Db,
  Expense,
  Machine,
  Partner,
  Point,
  PointCounter,
  ProductionLog,
  Product,
  Profile,
  Receipt,
  Sale,
  SalePayment,
  Settlement,
  SettlementLine,
  Vehicle,
  Withdrawal,
} from "../src/lib/data/types";

loadEnv({ path: ".env.local" });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Faltam NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY em .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export const DEMO_PASSWORD = "mineraponto-demo";
const OWNER_EMAIL = "dono@demo.mineraponto.app";
const OFFICE_EMAIL = "escritorio@demo.mineraponto.app";
const FIELD_EMAIL = "campo@demo.mineraponto.app";

// ---------- PRNG determinístico (mesmos números a cada rodada) ----------
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(20260812);
const pick = <T>(arr: T[]): T => {
  const item = arr[Math.floor(rnd() * arr.length)];
  if (item === undefined) throw new Error("pick em array vazio");
  return item;
};
const randInt = (min: number, max: number) => min + Math.floor(rnd() * (max - min + 1));
const id = () => randomUUID();

function iso(d: Date): string {
  return d.toISOString();
}
function addDays(d: Date, days: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + days);
  return r;
}
function startOfDay(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}
function atTime(day: Date, hours: number, minutes: number): Date {
  const r = new Date(day);
  r.setHours(hours, minutes, randInt(0, 59), 0);
  return r;
}
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

async function chunkedInsert<T extends object>(table: string, rows: T[], size = 500) {
  for (let i = 0; i < rows.length; i += size) {
    const chunk = rows.slice(i, i + size);
    const { error } = await supabase.from(table).insert(chunk);
    if (error) throw new Error(`Falha ao inserir em '${table}': ${error.message}`);
  }
  console.log(`  ✓ ${table}: ${rows.length} linha(s)`);
}

async function main() {
  console.log("MineraPonto — seed de demonstração\n");

  const { data: existing } = await supabase.auth.admin.listUsers();
  if (existing?.users.some((u) => u.email === OWNER_EMAIL)) {
    console.log(`Já existe um usuário ${OWNER_EMAIL} — seed já rodou antes, não faço nada.`);
    console.log("(Para semear de novo, apague os dados no dashboard do Supabase primeiro.)");
    return;
  }

  // ---------- 1. Empresa ----------
  const companyId = id();
  const now = iso(addDays(new Date(), -65));
  const company: Company = { id: companyId, created_at: now, name: "MineraPonto Demo" };
  const { error: companyError } = await supabase.from("companies").insert(company);
  if (companyError) throw new Error(`Falha ao criar empresa: ${companyError.message}`);
  console.log(`  ✓ companies: 1 linha ("${company.name}")`);

  // ---------- 2. Usuários (Auth + profiles) ----------
  const profiles: Profile[] = [];
  for (const [email, name, role] of [
    [OWNER_EMAIL, "Seu José (dono)", "owner"],
    [OFFICE_EMAIL, "Maria (escritório)", "office"],
    [FIELD_EMAIL, "Operador de Campo", "field"],
  ] as const) {
    const { data: created, error } = await supabase.auth.admin.createUser({
      email,
      password: DEMO_PASSWORD,
      email_confirm: true,
    });
    if (error || !created.user) throw new Error(`Falha ao criar usuário ${email}: ${error?.message}`);
    profiles.push({ id: created.user.id, created_at: now, company_id: companyId, name, role });
  }
  await chunkedInsert("profiles", profiles);
  const ownerProfileId = profiles[0]!.id;
  const fieldProfileId = profiles[2]!.id;
  const officeProfileId = profiles[1]!.id;

  // ---------- 3. Pontos ----------
  const pointAreal: Point = { id: id(), created_at: now, company_id: companyId, name: "Areal 1 — Rio Betim", city: "Betim" };
  const pointSaibreira: Point = { id: id(), created_at: now, company_id: companyId, name: "Saibreira — Esmeraldas", city: "Esmeraldas" };
  await chunkedInsert("points", [pointAreal, pointSaibreira]);

  const counters = new Map<string, { prefix: string; next_no: number }>([
    [pointAreal.id, { prefix: "PA1", next_no: 1 }],
    [pointSaibreira.id, { prefix: "SB1", next_no: 1 }],
  ]);

  // ---------- 4. Sócios / dono do terreno ----------
  const partner = (
    name: string,
    pointId: string,
    kind: Partner["kind"],
    percent: number | null,
    model: Partner["landowner_model"] = null,
    value: number | null = null
  ): Partner => ({
    id: id(),
    created_at: now,
    company_id: companyId,
    point_id: pointId,
    name,
    kind,
    percent,
    landowner_model: model,
    landowner_value: value,
  });
  const partners: Partner[] = [
    partner("João", pointAreal.id, "partner", 50),
    partner("Antônio", pointAreal.id, "partner", 30),
    partner("Carlos", pointAreal.id, "partner", 20),
    partner("Sr. Geraldo (terreno)", pointAreal.id, "landowner", null, "revenue_pct", 1000),
    partner("João", pointSaibreira.id, "partner", 60),
    partner("Antônio", pointSaibreira.id, "partner", 40),
    partner("Dona Rita (terreno)", pointSaibreira.id, "landowner", null, "fixed", 150000),
  ];
  await chunkedInsert("partners", partners);

  // ---------- 5. Máquinas ----------
  const machine = (name: string, pointId: string): Machine => ({
    id: id(),
    created_at: now,
    company_id: companyId,
    point_id: pointId,
    name,
  });
  const machines: Machine[] = [
    machine("Pá carregadeira W20", pointAreal.id),
    machine("Draga 1", pointAreal.id),
    machine("Escavadeira PC150", pointSaibreira.id),
    machine("Caminhão basculante MB", pointSaibreira.id),
  ];
  await chunkedInsert("machines", machines);

  // ---------- 6. Clientes ----------
  const client = (name: string, phone: string, creditEnabled: boolean, creditLimit: number): Client => ({
    id: id(),
    created_at: now,
    company_id: companyId,
    name,
    phone,
    doc: null,
    credit_enabled: creditEnabled,
    credit_limit: creditLimit,
  });
  const clients: Client[] = [
    client("Construtora Silva", "31999990001", true, 1500000),
    client("J. Pereira Ltda", "31999990002", true, 0),
    client("Costa Materiais", "31999990003", true, 1000000),
    client("M. Obras", "31999990004", false, 0),
    client("Depósito Bela Vista", "31999990005", false, 0),
    client("Pavimentadora MG", "31999990006", false, 0),
    client("Sítio Recanto", "31999990007", false, 0),
    client("Empreiteira Horizonte", "31999990008", false, 0),
  ];
  await chunkedInsert("clients", clients);
  const creditClients = clients.filter((c) => c.credit_enabled);

  // ---------- 7. Veículos ----------
  const vehicle = (label: string, capacity: number, plate: string | null = null, clientId: string | null = null): Vehicle => ({
    id: id(),
    created_at: now,
    company_id: companyId,
    client_id: clientId,
    plate,
    label,
    capacity_m3: capacity,
  });
  const vehicles: Vehicle[] = [
    vehicle("Toco 4 m³", 4),
    vehicle("Toco 5 m³", 5),
    vehicle("Truck 8 m³", 8),
    vehicle("Truck 10 m³", 10),
    vehicle("Caçamba 12 m³", 12, "QNP2A18"),
    vehicle("Caçamba 14 m³", 14),
    vehicle("Bitruck 16 m³", 16),
    vehicle("Carreta 20 m³", 20),
    vehicle("Carreta 25 m³", 25, "ABC1D23"),
    vehicle("Agregado 6 m³", 6),
  ];
  await chunkedInsert("vehicles", vehicles);

  // ---------- 8. Produtos ----------
  const product = (name: string, pointId: string, price: number): Product => ({
    id: id(),
    created_at: now,
    company_id: companyId,
    point_id: pointId,
    name,
    price_per_m3: price,
  });
  const products: Product[] = [
    product("Areia lavada", pointAreal.id, 12000),
    product("Areia fina", pointAreal.id, 11000),
    product("Saibro", pointSaibreira.id, 7000),
    product("Cascalho", pointSaibreira.id, 9000),
  ];
  await chunkedInsert("products", products);

  // ---------- 9. Movimento de ~60 dias ----------
  console.log("\nGerando ~60 dias de movimento (pode levar um minuto)...");
  const points = [pointAreal, pointSaibreira];
  const sales: Sale[] = [];
  const salePayments: SalePayment[] = [];
  const expenses: Expense[] = [];
  const withdrawals: Withdrawal[] = [];
  const productionLogs: ProductionLog[] = [];
  const receipts: Receipt[] = [];

  const nowDate = new Date();
  const start = addDays(startOfDay(nowDate), -60);

  for (const point of points) {
    const pointProducts = products.filter((p) => p.point_id === point.id);
    const pointMachines = machines.filter((m) => m.point_id === point.id);
    const counter = counters.get(point.id)!;
    const productionFactor = point.id === pointAreal.id ? 1 / 0.93 : 1.01;

    for (let d = 0; d <= 60; d++) {
      const day = addDays(start, d);
      if (day.getDay() === 0 || day > nowDate) continue;

      let dayM3 = 0;
      const salesCount = randInt(6, 14);
      for (let i = 0; i < salesCount; i++) {
        const saleTime = atTime(day, randInt(7, 16), randInt(0, 59));
        if (saleTime > nowDate) continue;
        const prod = pick(pointProducts);
        const qty = pick([4, 5, 6, 8, 8, 10, 12, 12, 14, 16, 20, 25]);
        const total = qty * prod.price_per_m3;
        dayM3 += qty;

        const roll = rnd();
        let clientId: string | null = null;
        const payments: Array<{ method: SalePayment["method"]; amount: number }> = [];
        if (roll < 0.45) {
          clientId = rnd() < 0.5 ? pick(clients).id : null;
          payments.push({ method: "cash", amount: total });
        } else if (roll < 0.7) {
          clientId = rnd() < 0.5 ? pick(clients).id : null;
          payments.push({ method: "pix", amount: total });
        } else {
          const c = pick(creditClients);
          clientId = c.id;
          if (rnd() < 0.55) {
            const nowPart = Math.round(total * pick([0.2, 0.25, 0.3, 0.5]));
            payments.push({ method: rnd() < 0.5 ? "cash" : "pix", amount: nowPart });
            payments.push({ method: "credit", amount: total - nowPart });
          } else {
            payments.push({ method: "credit", amount: total });
          }
        }

        const saleId = id();
        const receiptNo = `${counter.prefix}-${String(counter.next_no).padStart(6, "0")}`;
        counter.next_no += 1;

        sales.push({
          id: saleId,
          created_at: iso(saleTime),
          company_id: companyId,
          point_id: point.id,
          product_id: prod.id,
          client_id: clientId,
          qty_m3: qty,
          unit_price: prod.price_per_m3,
          discount_pct: 0,
          total,
          receipt_no: receiptNo,
          status: "active",
          cancel_reason: null,
          canceled_at: null,
          canceled_by: null,
          photo_url: null,
          gps_lat: null,
          gps_lng: null,
          created_by: fieldProfileId,
        });
        for (const p of payments) {
          salePayments.push({ id: id(), created_at: iso(saleTime), sale_id: saleId, method: p.method, amount: p.amount });
        }
      }

      if (dayM3 > 0) {
        productionLogs.push({
          id: id(),
          created_at: iso(atTime(day, 17, 30)),
          company_id: companyId,
          point_id: point.id,
          machine_id: pointMachines[0]?.id ?? null,
          log_date: iso(day).slice(0, 10),
          trips: null,
          m3: Math.round(dayM3 * productionFactor * 10) / 10,
          created_by: fieldProfileId,
        });
      }

      if (day.getDay() === 2 || day.getDay() === 5 || (day.getDay() === 3 && rnd() < 0.5)) {
        const liters = randInt(80, 180);
        const at = iso(atTime(day, randInt(7, 17), randInt(0, 59)));
        expenses.push({
          id: id(), created_at: at, company_id: companyId, point_id: point.id,
          machine_id: pointMachines.length > 0 ? pick(pointMachines).id : null,
          category: "diesel", amount: liters * 590, liters, note: null, photo_url: null,
          spent_at: at, created_by: fieldProfileId, status: "active", cancel_reason: null,
        });
      }
      if (rnd() < 0.08) {
        const at = iso(atTime(day, randInt(7, 17), randInt(0, 59)));
        expenses.push({
          id: id(), created_at: at, company_id: companyId, point_id: point.id, machine_id: null,
          category: "part_service", amount: randInt(150, 1200) * 100, liters: null, note: null, photo_url: null,
          spent_at: at, created_by: fieldProfileId, status: "active", cancel_reason: null,
        });
      }
      if (day.getDay() === 6) {
        const at = iso(atTime(day, randInt(7, 17), randInt(0, 59)));
        expenses.push({
          id: id(), created_at: at, company_id: companyId, point_id: point.id, machine_id: null,
          category: "labor", amount: randInt(600, 1400) * 100, liters: null, note: null, photo_url: null,
          spent_at: at, created_by: fieldProfileId, status: "active", cancel_reason: null,
        });
      }
      if (rnd() < 0.05) {
        const at = iso(atTime(day, randInt(7, 17), randInt(0, 59)));
        expenses.push({
          id: id(), created_at: at, company_id: companyId, point_id: point.id, machine_id: null,
          category: "freight", amount: randInt(100, 500) * 100, liters: null, note: null, photo_url: null,
          spent_at: at, created_by: fieldProfileId, status: "active", cancel_reason: null,
        });
      }
    }

    // recebimentos: paga ~70% do fiado acumulado, em parcelas
    const creditByClient = new Map<string, number>();
    for (const sale of sales.filter((s) => s.point_id === point.id && s.client_id)) {
      const credit = salePayments
        .filter((p) => p.sale_id === sale.id && p.method === "credit")
        .reduce((sum, p) => sum + p.amount, 0);
      if (credit > 0) creditByClient.set(sale.client_id!, (creditByClient.get(sale.client_id!) ?? 0) + credit);
    }
    for (const [clientId, totalCredit] of creditByClient) {
      let toPay = Math.round(totalCredit * 0.7);
      let guard = 0;
      while (toPay > 5000 && guard < 12) {
        guard++;
        const amount = Math.min(toPay, pick([30000, 50000, 80000, 100000, 200000]));
        const day = addDays(startOfDay(nowDate), -randInt(0, 40));
        if (day.getDay() === 0) continue;
        const at = iso(atTime(day, randInt(8, 17), randInt(0, 59)));
        receipts.push({
          id: id(), created_at: at, company_id: companyId, point_id: point.id, client_id: clientId,
          amount, method: pick(["cash", "pix", "pix", "transfer"]), received_at: at, note: null,
          created_by: officeProfileId, status: "active", cancel_reason: null,
        });
        toPay -= amount;
      }
    }

    // retiradas de sócio
    for (const p of partners.filter((x) => x.point_id === point.id && x.kind === "partner")) {
      const count = randInt(4, 9);
      for (let i = 0; i < count; i++) {
        const day = addDays(startOfDay(nowDate), -randInt(0, 58));
        if (day.getDay() === 0) continue;
        const at = iso(atTime(day, randInt(8, 17), randInt(0, 59)));
        withdrawals.push({
          id: id(), created_at: at, company_id: companyId, point_id: point.id, partner_id: p.id,
          amount: pick([20000, 30000, 50000, 80000, 100000, 150000]),
          note: pick(["vale", "adiantamento", "retirada", null]),
          withdrawn_at: at, created_by: ownerProfileId, status: "active", cancel_reason: null,
        });
      }
    }
  }

  await chunkedInsert("sales", sales);
  await chunkedInsert("sale_payments", salePayments);
  await chunkedInsert("receipts", receipts);
  await chunkedInsert("expenses", expenses);
  await chunkedInsert("withdrawals", withdrawals);
  await chunkedInsert("production_logs", productionLogs);

  const pointCounters: PointCounter[] = points.map((p) => {
    const c = counters.get(p.id)!;
    return { point_id: p.id, prefix: c.prefix, next_no: c.next_no };
  });
  await chunkedInsert("point_counters", pointCounters);

  // ---------- 10. Acerto já fechado por ponto (mês anterior) ----------
  console.log("\nFechando 1 acerto por ponto (histórico)...");
  const cutoff = addDays(nowDate, -30);
  cutoff.setHours(23, 59, 59, 999);
  const periodEnd = iso(cutoff);

  const dbSoFar: Db = {
    companies: [company],
    profiles,
    points,
    partners,
    machines,
    clients,
    vehicles,
    products,
    sales,
    sale_payments: salePayments,
    receipts,
    expenses,
    withdrawals,
    production_logs: productionLogs,
    settlements: [],
    settlement_lines: [],
    point_counters: pointCounters,
  };

  const settlements: Settlement[] = [];
  const settlementLines: SettlementLine[] = [];
  for (const point of points) {
    const periodStart = openPeriodStart(dbSoFar, point.id);
    const calc = computeSettlement(dbSoFar, point.id, periodStart, periodEnd);
    const settlementId = id();
    settlements.push({
      id: settlementId,
      created_at: periodEnd,
      company_id: companyId,
      point_id: point.id,
      period_start: calc.period_start,
      period_end: calc.period_end,
      closed_at: periodEnd,
      closed_by: ownerProfileId,
      cash_in: calc.cash_in,
      gross_sales: calc.gross_sales,
      expenses_total: calc.expenses_total,
      landowner_payout: calc.landowner_payout,
      profit_pool: calc.profit_pool,
      snapshot: calc,
    });
    for (const line of calc.lines) {
      settlementLines.push({
        id: id(),
        created_at: periodEnd,
        settlement_id: settlementId,
        partner_id: line.partner_id,
        partner_name: line.partner_name,
        kind: line.kind,
        base_amount: line.base_amount,
        withdrawals_total: line.withdrawals_total,
        final_amount: line.final_amount,
      });
    }
  }
  await chunkedInsert("settlements", settlements);
  await chunkedInsert("settlement_lines", settlementLines);

  console.log("\n✓ Seed concluído.");
  console.log(`\nUsuários demo (senha única: "${DEMO_PASSWORD}"):`);
  console.log(`  ${OWNER_EMAIL}  (owner)`);
  console.log(`  ${OFFICE_EMAIL}  (office)`);
  console.log(`  ${FIELD_EMAIL}  (field)`);
}

main().catch((err) => {
  console.error("\nSeed falhou:", err);
  process.exit(1);
});
