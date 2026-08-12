"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";
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
// Venda (§7.1, §7.4) — grava via RPC create_sale (atômica: contador +
// venda + pagamentos numa transação só, ver migration 20260812000400).
// ============================================================

export type CreateSaleResult = { saleId: string; receiptNo: string };

export async function createSale(formData: FormData): Promise<CreateSaleResult> {
  const supabase = await createSupabaseClient();
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

  const { data: product, error: productError } = await supabase
    .from("products")
    .select("*")
    .eq("id", productId)
    .eq("point_id", point.id)
    .maybeSingle();
  if (productError || !product) throw new Error("Produto não encontrado neste ponto.");

  let client: { id: string; credit_enabled: boolean } | null = null;
  if (clientIdRaw) {
    const { data } = await supabase
      .from("clients")
      .select("id, credit_enabled")
      .eq("id", clientIdRaw)
      .maybeSingle();
    if (!data) throw new Error("Cliente não encontrado.");
    client = data;
  }

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

  const photoPath = await savePhoto(photo, profile.company_id, supabase);

  const payments: Array<{ method: PaymentMethod; amount: number }> = [];
  if (payingNowAmount > 0) payments.push({ method: payingNowMethod, amount: payingNowAmount });
  if (creditAmount > 0) payments.push({ method: "credit", amount: creditAmount });

  const { data, error } = await supabase.rpc("create_sale", {
    p_point_id: point.id,
    p_product_id: product.id,
    p_client_id: client?.id ?? null,
    p_qty_m3: qtyM3,
    p_unit_price: product.price_per_m3,
    p_total: total,
    p_photo_url: photoPath,
    p_gps_lat: gpsLat,
    p_gps_lng: gpsLng,
    p_payments: payments,
  });
  if (error || !data?.[0]) {
    throw new Error(`Não foi possível registrar a venda: ${error?.message ?? "erro desconhecido"}`);
  }

  revalidatePath("/campo");
  return { saleId: data[0].id, receiptNo: data[0].receipt_no };
}

// ============================================================
// Cliente novo (quick add — só nome + telefone)
// ============================================================

export type CreateClientResult = { id: string; name: string; phone: string | null };

export async function createClient(formData: FormData): Promise<CreateClientResult> {
  const supabase = await createSupabaseClient();
  const profile = await getCurrentProfile();
  const name = requireString(formData, "name");
  const phone = optionalString(formData, "phone");

  const { data, error } = await supabase
    .from("clients")
    .insert({
      company_id: profile.company_id,
      name,
      phone,
      doc: null,
      credit_enabled: false,
      credit_limit: 0,
    })
    .select("id, name, phone")
    .single();
  if (error || !data) throw new Error(`Não foi possível criar o cliente: ${error?.message}`);

  return data;
}

// ============================================================
// Produção (§8 /campo/producao)
// ============================================================

export async function createProductionLog(formData: FormData): Promise<void> {
  const supabase = await createSupabaseClient();
  const profile = await getCurrentProfile();
  const point = await getActivePoint();

  const machineId = optionalString(formData, "machine_id");
  const trips = optionalNumber(formData, "trips");
  const m3 = requireNumber(formData, "m3");

  const { error } = await supabase.from("production_logs").insert({
    company_id: profile.company_id,
    point_id: point.id,
    machine_id: machineId,
    log_date: new Date().toISOString().slice(0, 10),
    trips,
    m3,
    created_by: profile.id,
  });
  if (error) throw new Error(`Não foi possível salvar a produção: ${error.message}`);

  revalidatePath("/campo/producao");
}

// ============================================================
// Gasto (§8 /campo/producao)
// ============================================================

export async function createExpense(formData: FormData): Promise<void> {
  const supabase = await createSupabaseClient();
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

  let photoPath: string | null = null;
  if (photo instanceof File && photo.size > 0) {
    photoPath = await savePhoto(photo, profile.company_id, supabase);
  }

  const now = new Date().toISOString();
  const { error } = await supabase.from("expenses").insert({
    company_id: profile.company_id,
    point_id: point.id,
    machine_id: machineId,
    category: category as ExpenseCategory,
    amount,
    liters,
    note: null,
    photo_url: photoPath,
    spent_at: now,
    created_by: profile.id,
    status: "active",
    cancel_reason: null,
  });
  if (error) throw new Error(`Não foi possível salvar o gasto: ${error.message}`);

  revalidatePath("/campo/producao");
}

// ============================================================
// Troca de ponto ativo (plumbing: profiles não têm point_id no schema —
// o usuário acessa todos os pontos da empresa, então o ponto ativo do
// campo fica no cookie mesmo com auth real)
// ============================================================

export async function setActivePoint(pointId: string): Promise<void> {
  const jar = await cookies();
  jar.set(ACTIVE_POINT_COOKIE, pointId, { path: "/", sameSite: "lax" });
  revalidatePath("/campo");
}
