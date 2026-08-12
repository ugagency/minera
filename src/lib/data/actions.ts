"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { mutateDb, readDb } from "./db";
import { nextReceiptNo } from "./receipt-no";
import { getCurrentProfile, getActivePoint, ACTIVE_POINT_COOKIE } from "@/lib/session";
import { savePhoto } from "@/lib/storage";
import type { ExpenseCategory, PaymentMethod } from "./types";

const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  "diesel",
  "part_service",
  "labor",
  "freight",
  "other",
];

function requireString(formData: FormData, key: string): string {
  const v = formData.get(key);
  if (typeof v !== "string" || v.trim() === "") {
    throw new Error(`Campo obrigatório ausente: ${key}`);
  }
  return v;
}

function optionalString(formData: FormData, key: string): string | null {
  const v = formData.get(key);
  if (typeof v !== "string" || v.trim() === "") return null;
  return v;
}

function requireNumber(formData: FormData, key: string): number {
  const v = Number(requireString(formData, key));
  if (Number.isNaN(v)) throw new Error(`Campo numérico inválido: ${key}`);
  return v;
}

function optionalNumber(formData: FormData, key: string): number | null {
  const raw = optionalString(formData, key);
  if (raw === null) return null;
  const v = Number(raw);
  return Number.isNaN(v) ? null : v;
}

// ============================================================
// Venda (§7.1, §7.4)
// ============================================================

export type CreateSaleResult = { saleId: string; receiptNo: string };

export async function createSale(formData: FormData): Promise<CreateSaleResult> {
  const profile = await getCurrentProfile();
  const point = await getActivePoint();

  const productId = requireString(formData, "product_id");
  const clientIdRaw = optionalString(formData, "client_id");
  const qtyM3 = requireNumber(formData, "qty_m3");
  const payingNowAmount = requireNumber(formData, "paying_now_amount"); // centavos
  const payingNowMethod = requireString(formData, "paying_now_method") as PaymentMethod;
  const gpsLat = optionalNumber(formData, "gps_lat");
  const gpsLng = optionalNumber(formData, "gps_lng");
  const photo = formData.get("photo");

  if (payingNowMethod !== "cash" && payingNowMethod !== "pix") {
    throw new Error("Forma de pagamento inválida.");
  }
  if (!(photo instanceof File) || photo.size === 0) {
    throw new Error("Foto de retirada é obrigatória.");
  }

  const db = readDb();
  const product = db.products.find(
    (p) => p.id === productId && p.point_id === point.id
  );
  if (!product) throw new Error("Produto não encontrado neste ponto.");

  const client = clientIdRaw
    ? db.clients.find((c) => c.id === clientIdRaw && c.company_id === profile.company_id)
    : null;
  if (clientIdRaw && !client) throw new Error("Cliente não encontrado.");

  // total sempre recalculado no servidor a partir do preço-snapshot (nunca confia no client).
  const total = Math.round(qtyM3 * product.price_per_m3);
  const creditAmount = total - payingNowAmount;

  if (creditAmount > 0) {
    if (!client) {
      throw new Error("Venda avulsa não pode ter fiado — pagamento deve cobrir o total.");
    }
    if (!client.credit_enabled) {
      throw new Error("Cliente sem fiado habilitado — pagamento deve cobrir o total.");
    }
  }
  if (payingNowAmount > total) {
    throw new Error("Valor pago agora não pode ser maior que o total.");
  }

  const photoUrl = await savePhoto(photo, profile.company_id);

  const result = mutateDb((db) => {
    const receiptNo = nextReceiptNo(db, point.id);
    const saleId = crypto.randomUUID();
    const now = new Date().toISOString();

    db.sales.push({
      id: saleId,
      created_at: now,
      company_id: profile.company_id,
      point_id: point.id,
      product_id: product.id,
      client_id: client?.id ?? null,
      qty_m3: qtyM3,
      unit_price: product.price_per_m3,
      discount_pct: 0,
      total,
      receipt_no: receiptNo,
      status: "active",
      cancel_reason: null,
      canceled_at: null,
      canceled_by: null,
      photo_url: photoUrl,
      gps_lat: gpsLat,
      gps_lng: gpsLng,
      created_by: profile.id,
    });

    if (payingNowAmount > 0) {
      db.sale_payments.push({
        id: crypto.randomUUID(),
        created_at: now,
        sale_id: saleId,
        method: payingNowMethod,
        amount: payingNowAmount,
      });
    }
    if (creditAmount > 0) {
      db.sale_payments.push({
        id: crypto.randomUUID(),
        created_at: now,
        sale_id: saleId,
        method: "credit",
        amount: creditAmount,
      });
    }

    return { saleId, receiptNo };
  });

  revalidatePath("/campo");
  return result;
}

// ============================================================
// Cliente novo (quick add — só nome + telefone)
// ============================================================

export type CreateClientResult = { id: string; name: string; phone: string | null };

export async function createClient(formData: FormData): Promise<CreateClientResult> {
  const profile = await getCurrentProfile();
  const name = requireString(formData, "name");
  const phone = optionalString(formData, "phone");

  return mutateDb((db) => {
    const id = crypto.randomUUID();
    db.clients.push({
      id,
      created_at: new Date().toISOString(),
      company_id: profile.company_id,
      name,
      phone,
      doc: null,
      credit_enabled: false,
      credit_limit: 0,
    });
    return { id, name, phone };
  });
}

// ============================================================
// Produção (§8 /campo/producao)
// ============================================================

export async function createProductionLog(formData: FormData): Promise<void> {
  const profile = await getCurrentProfile();
  const point = await getActivePoint();

  const machineId = optionalString(formData, "machine_id");
  const trips = optionalNumber(formData, "trips");
  const m3 = requireNumber(formData, "m3");

  mutateDb((db) => {
    db.production_logs.push({
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      company_id: profile.company_id,
      point_id: point.id,
      machine_id: machineId,
      log_date: new Date().toISOString().slice(0, 10),
      trips,
      m3,
      created_by: profile.id,
    });
  });

  revalidatePath("/campo/producao");
}

// ============================================================
// Gasto (§8 /campo/producao)
// ============================================================

export async function createExpense(formData: FormData): Promise<void> {
  const profile = await getCurrentProfile();
  const point = await getActivePoint();

  const category = requireString(formData, "category");
  if (!EXPENSE_CATEGORIES.includes(category as ExpenseCategory)) {
    throw new Error("Categoria de gasto inválida.");
  }
  const amount = requireNumber(formData, "amount"); // centavos
  const liters = optionalNumber(formData, "liters");
  const machineId = optionalString(formData, "machine_id");
  const photo = formData.get("photo");

  let photoUrl: string | null = null;
  if (photo instanceof File && photo.size > 0) {
    photoUrl = await savePhoto(photo, profile.company_id);
  }

  mutateDb((db) => {
    db.expenses.push({
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      company_id: profile.company_id,
      point_id: point.id,
      machine_id: machineId,
      category: category as ExpenseCategory,
      amount,
      liters,
      note: null,
      photo_url: photoUrl,
      spent_at: new Date().toISOString(),
      created_by: profile.id,
      status: "active",
      cancel_reason: null,
    });
  });

  revalidatePath("/campo/producao");
}

// ============================================================
// Troca de ponto ativo (plumbing temporário — some quando F1/auth
// vincular o usuário de campo aos pontos que ele acessa)
// ============================================================

export async function setActivePoint(pointId: string): Promise<void> {
  const jar = await cookies();
  jar.set(ACTIVE_POINT_COOKIE, pointId, { path: "/", sameSite: "lax" });
  revalidatePath("/campo");
}
