"use server";

import { revalidatePath } from "next/cache";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { readDb } from "./db";
import { computeSettlement, isCoveredBySettlement, openPeriodStart } from "./settlement";
import { getCurrentProfile } from "@/lib/session";
import type { ExpenseCategory, PartnerKind, ReceiptMethod } from "./types";

function req(formData: FormData, key: string): string {
  const v = formData.get(key);
  if (typeof v !== "string" || v.trim() === "") {
    throw new Error(`Campo obrigatório: ${key}`);
  }
  return v.trim();
}

function opt(formData: FormData, key: string): string | null {
  const v = formData.get(key);
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

function reqInt(formData: FormData, key: string): number {
  const v = Number(req(formData, key));
  if (!Number.isFinite(v)) throw new Error(`Valor inválido: ${key}`);
  return Math.round(v);
}

// ============================================================
// Recebimento de fiado (F3 — modal de 3 campos)
// ============================================================

export async function createReceipt(formData: FormData): Promise<void> {
  const supabase = await createSupabaseClient();
  const profile = await getCurrentProfile();
  const clientId = req(formData, "client_id");
  const pointId = req(formData, "point_id");
  const amount = reqInt(formData, "amount"); // centavos
  const method = req(formData, "method") as ReceiptMethod;

  if (amount <= 0) throw new Error("Informe um valor maior que zero.");
  if (!["cash", "pix", "transfer"].includes(method)) {
    throw new Error("Forma de recebimento inválida.");
  }

  const now = new Date().toISOString();
  const { error } = await supabase.from("receipts").insert({
    company_id: profile.company_id,
    point_id: pointId,
    client_id: clientId,
    amount,
    method,
    received_at: now,
    note: opt(formData, "note"),
    created_by: profile.id,
    status: "active",
    cancel_reason: null,
  });
  if (error) throw new Error(`Não foi possível lançar o recebimento: ${error.message}`);

  revalidatePath("/app/clientes");
  revalidatePath("/app/financeiro");
  revalidatePath("/app");
}

// ============================================================
// Bloquear/liberar a prazo (toggle)
// ============================================================

export async function toggleClientCredit(clientId: string): Promise<void> {
  const supabase = await createSupabaseClient();
  const { data: client } = await supabase
    .from("clients")
    .select("credit_enabled")
    .eq("id", clientId)
    .maybeSingle();
  if (!client) throw new Error("Cliente não encontrado.");

  const { error } = await supabase
    .from("clients")
    .update({ credit_enabled: !client.credit_enabled })
    .eq("id", clientId);
  if (error) throw new Error(`Não foi possível atualizar o cliente: ${error.message}`);

  revalidatePath("/app/clientes");
}

export async function updateClient(formData: FormData): Promise<void> {
  const supabase = await createSupabaseClient();
  const id = req(formData, "id");

  const { error } = await supabase
    .from("clients")
    .update({
      name: req(formData, "name"),
      phone: opt(formData, "phone"),
      doc: opt(formData, "doc"),
      credit_enabled: formData.get("credit_enabled") === "on",
      credit_limit: reqInt(formData, "credit_limit"),
    })
    .eq("id", id);
  if (error) throw new Error(`Não foi possível salvar o cliente: ${error.message}`);

  revalidatePath("/app/clientes");
  revalidatePath("/app/cadastros");
}

export async function createClientFull(formData: FormData): Promise<void> {
  const supabase = await createSupabaseClient();
  const profile = await getCurrentProfile();

  const { error } = await supabase.from("clients").insert({
    company_id: profile.company_id,
    name: req(formData, "name"),
    phone: opt(formData, "phone"),
    doc: opt(formData, "doc"),
    credit_enabled: formData.get("credit_enabled") === "on",
    credit_limit: reqInt(formData, "credit_limit"),
  });
  if (error) throw new Error(`Não foi possível criar o cliente: ${error.message}`);

  revalidatePath("/app/clientes");
  revalidatePath("/app/cadastros");
}

// ============================================================
// Cancelamentos (§7.3) — nunca deletar; só owner/office; bloqueado
// se um settlement fechado cobre a data do lançamento
// ============================================================

type CancelKind = "sale" | "expense" | "receipt" | "withdrawal";

const CANCEL_TABLE: Record<CancelKind, "sales" | "expenses" | "receipts" | "withdrawals"> = {
  sale: "sales",
  expense: "expenses",
  receipt: "receipts",
  withdrawal: "withdrawals",
};

const CANCEL_DATE_FIELD: Record<CancelKind, string> = {
  sale: "created_at",
  expense: "spent_at",
  receipt: "received_at",
  withdrawal: "withdrawn_at",
};

export async function cancelEntity(
  kind: CancelKind,
  id: string,
  reason: string
): Promise<void> {
  const supabase = await createSupabaseClient();
  const profile = await getCurrentProfile();
  if (profile.role === "field") throw new Error("Sem permissão para cancelar.");
  if (!reason.trim()) throw new Error("Motivo do cancelamento é obrigatório.");

  const table = CANCEL_TABLE[kind];
  const dateField = CANCEL_DATE_FIELD[kind];

  const { data: entry } = await supabase.from(table).select("*").eq("id", id).maybeSingle();
  if (!entry) throw new Error("Lançamento não encontrado.");
  if (entry.status === "canceled") throw new Error("Já está cancelado.");

  const db = await readDb();
  const entryRecord = entry as unknown as Record<string, string>;
  const entryDate = entryRecord[dateField]!;
  const entryPointId = entryRecord.point_id!;
  if (isCoveredBySettlement(db, entryPointId, entryDate)) {
    throw new Error("Período já fechado — lance um ajuste no período aberto.");
  }

  const updates: Record<string, unknown> = {
    status: "canceled",
    cancel_reason: reason.trim(),
  };
  if (kind === "sale") {
    updates.canceled_at = new Date().toISOString();
    updates.canceled_by = profile.id;
  }

  const { error } = await supabase.from(table).update(updates as never).eq("id", id);
  if (error) throw new Error(`Não foi possível cancelar: ${error.message}`);

  revalidatePath("/app/vendas");
  revalidatePath("/app/gastos");
  revalidatePath("/app/retiradas");
  revalidatePath("/app/clientes");
  revalidatePath("/app/financeiro");
  revalidatePath("/app");
}

// ============================================================
// Retirada de sócio (F4 — 3 campos)
// ============================================================

export async function createWithdrawal(formData: FormData): Promise<void> {
  const supabase = await createSupabaseClient();
  const profile = await getCurrentProfile();
  const partnerId = req(formData, "partner_id");
  const amount = reqInt(formData, "amount");
  if (amount <= 0) throw new Error("Informe um valor maior que zero.");

  const { data: partner } = await supabase
    .from("partners")
    .select("id, point_id, kind")
    .eq("id", partnerId)
    .maybeSingle();
  if (!partner) throw new Error("Sócio não encontrado.");
  if (partner.kind !== "partner") throw new Error("Retirada é só para sócios.");

  const now = new Date().toISOString();
  const { error } = await supabase.from("withdrawals").insert({
    company_id: profile.company_id,
    point_id: partner.point_id,
    partner_id: partner.id,
    amount,
    note: opt(formData, "note"),
    withdrawn_at: now,
    created_by: profile.id,
    status: "active",
    cancel_reason: null,
  });
  if (error) throw new Error(`Não foi possível lançar a retirada: ${error.message}`);

  revalidatePath("/app/retiradas");
  revalidatePath("/app/financeiro");
  revalidatePath("/app");
}

// ============================================================
// Gasto pelo admin (mesmo form do campo, em desktop)
// ============================================================

export async function createExpenseAdmin(formData: FormData): Promise<void> {
  const supabase = await createSupabaseClient();
  const profile = await getCurrentProfile();
  const pointId = req(formData, "point_id");
  const category = req(formData, "category");
  const amount = reqInt(formData, "amount");
  if (amount <= 0) throw new Error("Informe um valor maior que zero.");
  if (!["diesel", "part_service", "labor", "freight", "other"].includes(category)) {
    throw new Error("Categoria inválida.");
  }

  const now = new Date().toISOString();
  const { error } = await supabase.from("expenses").insert({
    company_id: profile.company_id,
    point_id: pointId,
    machine_id: opt(formData, "machine_id"),
    category: category as ExpenseCategory,
    amount,
    liters: opt(formData, "liters") ? Number(opt(formData, "liters")) : null,
    note: opt(formData, "note"),
    photo_url: null,
    spent_at: now,
    created_by: profile.id,
    status: "active",
    cancel_reason: null,
  });
  if (error) throw new Error(`Não foi possível salvar o gasto: ${error.message}`);

  revalidatePath("/app/gastos");
  revalidatePath("/app/financeiro");
  revalidatePath("/app");
}

// ============================================================
// Fechar acerto (§7.2) — o cálculo é feito em TS (settlement.ts, puro);
// a persistência (settlement + lines) é atômica via RPC close_settlement.
// ============================================================

export async function closeSettlement(pointId: string): Promise<string> {
  const supabase = await createSupabaseClient();
  const profile = await getCurrentProfile();
  if (profile.role === "field") throw new Error("Sem permissão.");

  const db = await readDb();
  if (!db.points.some((p) => p.id === pointId)) throw new Error("Ponto não encontrado.");

  const start = openPeriodStart(db, pointId);
  const end = new Date().toISOString();
  const calc = computeSettlement(db, pointId, start, end);

  const { data, error } = await supabase.rpc("close_settlement", {
    p_point_id: pointId,
    p_period_start: start,
    p_period_end: end,
    p_cash_in: calc.cash_in,
    p_gross_sales: calc.gross_sales,
    p_expenses_total: calc.expenses_total,
    p_landowner_payout: calc.landowner_payout,
    p_profit_pool: calc.profit_pool,
    p_snapshot: calc,
    p_lines: calc.lines.map((l) => ({
      partner_id: l.partner_id,
      partner_name: l.partner_name,
      kind: l.kind,
      base_amount: l.base_amount,
      withdrawals_total: l.withdrawals_total,
      final_amount: l.final_amount,
    })),
  });
  if (error || !data?.[0]) {
    throw new Error(`Não foi possível fechar o acerto: ${error?.message ?? "erro desconhecido"}`);
  }

  revalidatePath("/app/financeiro");
  revalidatePath("/app");
  return data[0].id;
}

// ============================================================
// Cadastros (CRUDs enxutos — criar/editar, nunca deletar)
// ============================================================

export async function savePoint(formData: FormData): Promise<void> {
  const supabase = await createSupabaseClient();
  const profile = await getCurrentProfile();
  const id = opt(formData, "id");
  const prefix = req(formData, "prefix").toUpperCase();

  if (id) {
    const { error } = await supabase
      .from("points")
      .update({ name: req(formData, "name"), city: opt(formData, "city") })
      .eq("id", id);
    if (error) throw new Error(`Não foi possível salvar o ponto: ${error.message}`);

    const { error: counterError } = await supabase
      .from("point_counters")
      .update({ prefix })
      .eq("point_id", id);
    if (counterError) throw new Error(`Não foi possível salvar o prefixo: ${counterError.message}`);
  } else {
    const { data: point, error } = await supabase
      .from("points")
      .insert({
        company_id: profile.company_id,
        name: req(formData, "name"),
        city: opt(formData, "city"),
      })
      .select("id")
      .single();
    if (error || !point) throw new Error(`Não foi possível criar o ponto: ${error?.message}`);

    const { error: counterError } = await supabase
      .from("point_counters")
      .insert({ point_id: point.id, prefix, next_no: 1 });
    if (counterError) throw new Error(`Não foi possível criar o contador: ${counterError.message}`);
  }

  revalidatePath("/app/cadastros");
}

export async function savePartner(formData: FormData): Promise<void> {
  const supabase = await createSupabaseClient();
  const profile = await getCurrentProfile();
  const id = opt(formData, "id");
  const kind = req(formData, "kind") as PartnerKind;
  const percent = kind === "partner" ? Number(req(formData, "percent")) : null;
  const landownerModel =
    kind === "landowner" ? (req(formData, "landowner_model") as "revenue_pct" | "fixed") : null;
  const landownerValue = kind === "landowner" ? reqInt(formData, "landowner_value") : null;

  if (id) {
    const { error } = await supabase
      .from("partners")
      .update({
        name: req(formData, "name"),
        kind,
        percent,
        landowner_model: landownerModel,
        landowner_value: landownerValue,
      })
      .eq("id", id);
    if (error) throw new Error(`Não foi possível salvar o sócio: ${error.message}`);
  } else {
    const { error } = await supabase.from("partners").insert({
      company_id: profile.company_id,
      point_id: req(formData, "point_id"),
      name: req(formData, "name"),
      kind,
      percent,
      landowner_model: landownerModel,
      landowner_value: landownerValue,
    });
    if (error) throw new Error(`Não foi possível criar o sócio: ${error.message}`);
  }

  revalidatePath("/app/cadastros");
  revalidatePath("/app/financeiro");
}

export async function saveProduct(formData: FormData): Promise<void> {
  const supabase = await createSupabaseClient();
  const profile = await getCurrentProfile();
  const id = opt(formData, "id");

  if (id) {
    const { error } = await supabase
      .from("products")
      .update({ name: req(formData, "name"), price_per_m3: reqInt(formData, "price_per_m3") })
      .eq("id", id);
    if (error) throw new Error(`Não foi possível salvar o produto: ${error.message}`);
  } else {
    const { error } = await supabase.from("products").insert({
      company_id: profile.company_id,
      point_id: req(formData, "point_id"),
      name: req(formData, "name"),
      price_per_m3: reqInt(formData, "price_per_m3"),
    });
    if (error) throw new Error(`Não foi possível criar o produto: ${error.message}`);
  }

  revalidatePath("/app/cadastros");
}

export async function saveVehicle(formData: FormData): Promise<void> {
  const supabase = await createSupabaseClient();
  const profile = await getCurrentProfile();
  const id = opt(formData, "id");

  if (id) {
    const { error } = await supabase
      .from("vehicles")
      .update({
        label: req(formData, "label"),
        plate: opt(formData, "plate"),
        capacity_m3: Number(req(formData, "capacity_m3")),
      })
      .eq("id", id);
    if (error) throw new Error(`Não foi possível salvar o veículo: ${error.message}`);
  } else {
    const { error } = await supabase.from("vehicles").insert({
      company_id: profile.company_id,
      client_id: null,
      plate: opt(formData, "plate"),
      label: req(formData, "label"),
      capacity_m3: Number(req(formData, "capacity_m3")),
    });
    if (error) throw new Error(`Não foi possível criar o veículo: ${error.message}`);
  }

  revalidatePath("/app/cadastros");
}

export async function saveMachine(formData: FormData): Promise<void> {
  const supabase = await createSupabaseClient();
  const profile = await getCurrentProfile();
  const id = opt(formData, "id");

  if (id) {
    const { error } = await supabase
      .from("machines")
      .update({ name: req(formData, "name") })
      .eq("id", id);
    if (error) throw new Error(`Não foi possível salvar a máquina: ${error.message}`);
  } else {
    const { error } = await supabase.from("machines").insert({
      company_id: profile.company_id,
      point_id: req(formData, "point_id"),
      name: req(formData, "name"),
    });
    if (error) throw new Error(`Não foi possível criar a máquina: ${error.message}`);
  }

  revalidatePath("/app/cadastros");
}
