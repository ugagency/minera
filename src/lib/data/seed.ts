import type {
  Client,
  Db,
  Expense,
  Partner,
  ProductionLog,
  Receipt,
  Sale,
  SalePayment,
  Vehicle,
  Withdrawal,
} from "./types";

// Seed de demonstração (SPEC §10) gerado no data layer mock.
// Determinístico (PRNG com semente fixa) para os números serem reproduzíveis.

export const SEED_VERSION = 3;

export const COMPANY_ID = "seed-company";
export const OWNER_PROFILE_ID = "seed-profile-owner";
export const OFFICE_PROFILE_ID = "seed-profile-office";
export const FIELD_PROFILE_ID = "seed-profile-field";
export const POINT_AREAL_ID = "seed-point-areal1";
export const POINT_SAIBREIRA_ID = "seed-point-saibreira";

// ---------- PRNG determinístico ----------
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
const randInt = (min: number, max: number) =>
  min + Math.floor(rnd() * (max - min + 1));

let idCounter = 0;
const nextId = (prefix: string) => `seed-${prefix}-${++idCounter}`;

export function buildSeedDb(): Db {
  const now = new Date();
  const baseCreated = iso(addDays(now, -65));

  const db: Db = {
    companies: [
      { id: COMPANY_ID, created_at: baseCreated, name: "MineraPonto Demo" },
    ],
    profiles: [
      {
        id: OWNER_PROFILE_ID,
        created_at: baseCreated,
        company_id: COMPANY_ID,
        name: "Seu José (dono)",
        role: "owner",
      },
      {
        id: OFFICE_PROFILE_ID,
        created_at: baseCreated,
        company_id: COMPANY_ID,
        name: "Maria (escritório)",
        role: "office",
      },
      {
        id: FIELD_PROFILE_ID,
        created_at: baseCreated,
        company_id: COMPANY_ID,
        name: "Operador de Campo",
        role: "field",
      },
    ],
    points: [
      {
        id: POINT_AREAL_ID,
        created_at: baseCreated,
        company_id: COMPANY_ID,
        name: "Areal 1 — Rio Betim",
        city: "Betim",
      },
      {
        id: POINT_SAIBREIRA_ID,
        created_at: baseCreated,
        company_id: COMPANY_ID,
        name: "Saibreira — Esmeraldas",
        city: "Esmeraldas",
      },
    ],
    partners: buildPartners(baseCreated),
    machines: [
      machine("Pá carregadeira W20", POINT_AREAL_ID, baseCreated),
      machine("Draga 1", POINT_AREAL_ID, baseCreated),
      machine("Escavadeira PC150", POINT_SAIBREIRA_ID, baseCreated),
      machine("Caminhão basculante MB", POINT_SAIBREIRA_ID, baseCreated),
    ],
    clients: buildClients(baseCreated),
    vehicles: buildVehicles(baseCreated),
    products: [
      product("Areia lavada", POINT_AREAL_ID, 12000, baseCreated),
      product("Areia fina", POINT_AREAL_ID, 11000, baseCreated),
      product("Saibro", POINT_SAIBREIRA_ID, 7000, baseCreated),
      product("Cascalho", POINT_SAIBREIRA_ID, 9000, baseCreated),
    ],
    sales: [],
    sale_payments: [],
    receipts: [],
    expenses: [],
    withdrawals: [],
    production_logs: [],
    settlements: [],
    settlement_lines: [],
    point_counters: [
      { point_id: POINT_AREAL_ID, prefix: "PA1", next_no: 1 },
      { point_id: POINT_SAIBREIRA_ID, prefix: "SB1", next_no: 1 },
    ],
  };

  // ~60 dias de movimento por ponto
  generateMovement(db, now);

  return db;
}

function buildPartners(created: string): Partner[] {
  const p = (
    name: string,
    pointId: string,
    kind: Partner["kind"],
    percent: number | null,
    model: Partner["landowner_model"] = null,
    value: number | null = null
  ): Partner => ({
    id: nextId("partner"),
    created_at: created,
    company_id: COMPANY_ID,
    point_id: pointId,
    name,
    kind,
    percent,
    landowner_model: model,
    landowner_value: value,
  });
  return [
    p("João", POINT_AREAL_ID, "partner", 50),
    p("Antônio", POINT_AREAL_ID, "partner", 30),
    p("Carlos", POINT_AREAL_ID, "partner", 20),
    p("Sr. Geraldo (terreno)", POINT_AREAL_ID, "landowner", null, "revenue_pct", 1000), // 10,00%
    p("João", POINT_SAIBREIRA_ID, "partner", 60),
    p("Antônio", POINT_SAIBREIRA_ID, "partner", 40),
    p("Dona Rita (terreno)", POINT_SAIBREIRA_ID, "landowner", null, "fixed", 150000), // R$ 1.500,00
  ];
}

function machine(name: string, pointId: string, created: string) {
  return {
    id: nextId("machine"),
    created_at: created,
    company_id: COMPANY_ID,
    point_id: pointId,
    name,
  };
}

function product(
  name: string,
  pointId: string,
  price: number,
  created: string
) {
  return {
    id: nextId("product"),
    created_at: created,
    company_id: COMPANY_ID,
    point_id: pointId,
    name,
    price_per_m3: price,
  };
}

function buildClients(created: string): Client[] {
  const c = (
    name: string,
    phone: string,
    creditEnabled: boolean,
    creditLimit: number
  ): Client => ({
    id: nextId("client"),
    created_at: created,
    company_id: COMPANY_ID,
    name,
    phone,
    doc: null,
    credit_enabled: creditEnabled,
    credit_limit: creditLimit,
  });
  // 8 clientes; 3 com fiado habilitado (e saldo aberto gerado no movimento)
  return [
    c("Construtora Silva", "31999990001", true, 1500000),
    c("J. Pereira Ltda", "31999990002", true, 0),
    c("Costa Materiais", "31999990003", true, 1000000),
    c("M. Obras", "31999990004", false, 0),
    c("Depósito Bela Vista", "31999990005", false, 0),
    c("Pavimentadora MG", "31999990006", false, 0),
    c("Sítio Recanto", "31999990007", false, 0),
    c("Empreiteira Horizonte", "31999990008", false, 0),
  ];
}

function buildVehicles(created: string): Vehicle[] {
  const v = (
    label: string,
    capacity: number,
    plate: string | null = null,
    clientId: string | null = null
  ): Vehicle => ({
    id: nextId("vehicle"),
    created_at: created,
    company_id: COMPANY_ID,
    client_id: clientId,
    plate,
    label,
    capacity_m3: capacity,
  });
  return [
    v("Toco 4 m³", 4),
    v("Toco 5 m³", 5),
    v("Truck 8 m³", 8),
    v("Truck 10 m³", 10),
    v("Caçamba 12 m³", 12, "QNP2A18"),
    v("Caçamba 14 m³", 14),
    v("Bitruck 16 m³", 16),
    v("Carreta 20 m³", 20),
    v("Carreta 25 m³", 25, "ABC1D23"),
    v("Agregado 6 m³", 6),
  ];
}

// ---------- Movimento de ~60 dias ----------

function generateMovement(db: Db, now: Date): void {
  const start = addDays(startOfDay(now), -60);

  for (const point of db.points) {
    const products = db.products.filter((p) => p.point_id === point.id);
    const machines = db.machines.filter((m) => m.point_id === point.id);
    const creditClients = db.clients.filter((c) => c.credit_enabled);
    const allClients = db.clients;
    const counter = db.point_counters.find((c) => c.point_id === point.id);
    if (!counter) continue;

    // fator do detector §7.5: Areal vende ~7% MENOS do que produz
    const productionFactor = point.id === POINT_AREAL_ID ? 1 / 0.93 : 1.01;

    for (let d = 0; d <= 60; d++) {
      const day = addDays(start, d);
      if (day.getDay() === 0) continue; // domingo fechado
      if (day > now) break;

      let dayM3 = 0;
      const salesCount = randInt(6, 14);
      for (let i = 0; i < salesCount; i++) {
        const saleTime = atTime(day, randInt(7, 16), randInt(0, 59));
        if (saleTime > now) continue;
        const prod = pick(products);
        const qty = pick([4, 5, 6, 8, 8, 10, 12, 12, 14, 16, 20, 25]);
        const total = qty * prod.price_per_m3;
        dayM3 += qty;

        // mix: ≈45% dinheiro, 25% PIX, 30% com componente fiado
        const roll = rnd();
        let clientId: string | null = null;
        const payments: Array<{ method: SalePayment["method"]; amount: number }> = [];
        if (roll < 0.45) {
          clientId = rnd() < 0.5 ? pick(allClients).id : null; // avulsa ou identificada
          payments.push({ method: "cash", amount: total });
        } else if (roll < 0.7) {
          clientId = rnd() < 0.5 ? pick(allClients).id : null;
          payments.push({ method: "pix", amount: total });
        } else {
          const client = pick(creditClients);
          clientId = client.id;
          if (rnd() < 0.55) {
            // mista: parte agora, resto fiado
            const nowPart = Math.round(total * pick([0.2, 0.25, 0.3, 0.5]));
            payments.push({
              method: rnd() < 0.5 ? "cash" : "pix",
              amount: nowPart,
            });
            payments.push({ method: "credit", amount: total - nowPart });
          } else {
            payments.push({ method: "credit", amount: total });
          }
        }

        const saleId = nextId("sale");
        const receiptNo = `${counter.prefix}-${String(counter.next_no).padStart(6, "0")}`;
        counter.next_no += 1;

        const sale: Sale = {
          id: saleId,
          created_at: iso(saleTime),
          company_id: COMPANY_ID,
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
          created_by: FIELD_PROFILE_ID,
        };
        db.sales.push(sale);
        for (const p of payments) {
          db.sale_payments.push({
            id: nextId("payment"),
            created_at: iso(saleTime),
            sale_id: saleId,
            method: p.method,
            amount: p.amount,
          });
        }
      }

      // produção do dia (§7.5: Areal produz mais do que vende)
      if (dayM3 > 0) {
        const producedM3 = Math.round(dayM3 * productionFactor * 10) / 10;
        const log: ProductionLog = {
          id: nextId("prod"),
          created_at: iso(atTime(day, 17, 30)),
          company_id: COMPANY_ID,
          point_id: point.id,
          machine_id: machines[0]?.id ?? null,
          log_date: iso(day).slice(0, 10),
          trips: null,
          m3: producedM3,
          created_by: FIELD_PROFILE_ID,
        };
        db.production_logs.push(log);
      }

      // gastos: diesel 2–3x/semana, peças esporádicas, mão de obra semanal
      if (day.getDay() === 2 || day.getDay() === 5 || (day.getDay() === 3 && rnd() < 0.5)) {
        const liters = randInt(80, 180);
        pushExpense(db, point.id, "diesel", liters * 590, liters, machines, day);
      }
      if (rnd() < 0.08) {
        pushExpense(db, point.id, "part_service", randInt(150, 1200) * 100, null, machines, day);
      }
      if (day.getDay() === 6) {
        pushExpense(db, point.id, "labor", randInt(600, 1400) * 100, null, [], day);
      }
      if (rnd() < 0.05) {
        pushExpense(db, point.id, "freight", randInt(100, 500) * 100, null, [], day);
      }
    }

    // recebimentos de fiado: clientes pagam parte do que devem ao longo do tempo
    generateReceipts(db, point.id, now);

    // retiradas de sócio: 2–5/mês por sócio
    for (const partner of db.partners.filter(
      (p) => p.point_id === point.id && p.kind === "partner"
    )) {
      const count = randInt(4, 9); // ~2 meses
      for (let i = 0; i < count; i++) {
        const day = addDays(startOfDay(now), -randInt(0, 58));
        if (day.getDay() === 0) continue;
        const w: Withdrawal = {
          id: nextId("withdrawal"),
          created_at: iso(atTime(day, randInt(8, 17), randInt(0, 59))),
          company_id: COMPANY_ID,
          point_id: point.id,
          partner_id: partner.id,
          amount: pick([20000, 30000, 50000, 80000, 100000, 150000]),
          note: pick(["vale", "adiantamento", "retirada", null]),
          withdrawn_at: iso(atTime(day, randInt(8, 17), randInt(0, 59))),
          created_by: OWNER_PROFILE_ID,
          status: "active",
          cancel_reason: null,
        };
        w.created_at = w.withdrawn_at;
        db.withdrawals.push(w);
      }
    }
  }
}

function pushExpense(
  db: Db,
  pointId: string,
  category: Expense["category"],
  amount: number,
  liters: number | null,
  machines: Db["machines"],
  day: Date
): void {
  const at = iso(atTime(day, randInt(7, 17), randInt(0, 59)));
  db.expenses.push({
    id: nextId("expense"),
    created_at: at,
    company_id: COMPANY_ID,
    point_id: pointId,
    machine_id: category === "diesel" && machines.length > 0 ? pick(machines).id : null,
    category,
    amount,
    liters,
    note: null,
    photo_url: null,
    spent_at: at,
    created_by: FIELD_PROFILE_ID,
    status: "active",
    cancel_reason: null,
  });
}

/**
 * Clientes com fiado pagam ~70% do que acumularam, em parcelas espaçadas,
 * deixando saldo aberto (SPEC §10: 3 clientes com saldo em aberto).
 */
function generateReceipts(db: Db, pointId: string, now: Date): void {
  const creditByClient = new Map<string, number>();
  for (const sale of db.sales.filter(
    (s) => s.point_id === pointId && s.status === "active" && s.client_id
  )) {
    const credit = db.sale_payments
      .filter((p) => p.sale_id === sale.id && p.method === "credit")
      .reduce((sum, p) => sum + p.amount, 0);
    if (credit > 0) {
      creditByClient.set(
        sale.client_id!,
        (creditByClient.get(sale.client_id!) ?? 0) + credit
      );
    }
  }

  for (const [clientId, totalCredit] of creditByClient) {
    let toPay = Math.round(totalCredit * 0.7);
    let guard = 0;
    while (toPay > 5000 && guard < 12) {
      guard++;
      const amount = Math.min(toPay, pick([30000, 50000, 80000, 100000, 200000]));
      const day = addDays(startOfDay(now), -randInt(0, 40));
      if (day.getDay() === 0) continue;
      const at = iso(atTime(day, randInt(8, 17), randInt(0, 59)));
      const r: Receipt = {
        id: nextId("receipt"),
        created_at: at,
        company_id: COMPANY_ID,
        point_id: pointId,
        client_id: clientId,
        amount,
        method: pick(["cash", "pix", "pix", "transfer"]),
        received_at: at,
        note: null,
        created_by: OFFICE_PROFILE_ID,
        status: "active",
        cancel_reason: null,
      };
      db.receipts.push(r);
      toPay -= amount;
    }
  }
}

// ---------- datas ----------
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
