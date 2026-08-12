"use server";

import { revalidatePath } from "next/cache";
import { mutateDb, readDb } from "./db";
import {
  computeSettlement,
  isCoveredBySettlement,
  openPeriodStart,
  persistSettlement,
} from "./settlement";
import { getAdminProfile } from "@/lib/session";
import type { ReceiptMethod } from "./types";

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
  const profile = await getAdminProfile();
  const clientId = req(formData, "client_id");
  const pointId = req(formData, "point_id");
  const amount = reqInt(formData, "amount"); // centavos
  const method = req(formData, "method") as ReceiptMethod;

  if (amount <= 0) throw new Error("Informe um valor maior que zero.");
  if (!["cash", "pix", "transfer"].includes(method)) {
    throw new Error("Forma de recebimento inválida.");
  }

  mutateDb((db) => {
    if (!db.clients.some((c) => c.id === clientId)) throw new Error("Cliente não encontrado.");
    if (!db.points.some((p) => p.id === pointId)) throw new Error("Ponto não encontrado.");
    const now = new Date().toISOString();
    db.receipts.push({
      id: crypto.randomUUID(),
      created_at: now,
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
  });

  revalidatePath("/app/clientes");
  revalidatePath("/app/financeiro");
  revalidatePath("/app");
}

// ============================================================
// Bloquear/liberar a prazo (toggle)
// ============================================================

export async function toggleClientCredit(clientId: string): Promise<void> {
  mutateDb((db) => {
    const client = db.clients.find((c) => c.id === clientId);
    if (!client) throw new Error("Cliente não encontrado.");
    client.credit_enabled = !client.credit_enabled;
  });
  revalidatePath("/app/clientes");
}

export async function updateClient(formData: FormData): Promise<void> {
  const id = req(formData, "id");
  mutateDb((db) => {
    const client = db.clients.find((c) => c.id === id);
    if (!client) throw new Error("Cliente não encontrado.");
    client.name = req(formData, "name");
    client.phone = opt(formData, "phone");
    client.doc = opt(formData, "doc");
    client.credit_enabled = formData.get("credit_enabled") === "on";
    client.credit_limit = reqInt(formData, "credit_limit");
  });
  revalidatePath("/app/clientes");
  revalidatePath("/app/cadastros");
}

export async function createClientFull(formData: FormData): Promise<void> {
  const profile = await getAdminProfile();
  mutateDb((db) => {
    db.clients.push({
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      company_id: profile.company_id,
      name: req(formData, "name"),
      phone: opt(formData, "phone"),
      doc: opt(formData, "doc"),
      credit_enabled: formData.get("credit_enabled") === "on",
      credit_limit: reqInt(formData, "credit_limit"),
    });
  });
  revalidatePath("/app/clientes");
  revalidatePath("/app/cadastros");
}

// ============================================================
// Cancelamentos (§7.3) — nunca deletar; só owner/office; bloqueado
// se um settlement fechado cobre a data do lançamento
// ============================================================

type CancelKind = "sale" | "expense" | "receipt" | "withdrawal";

export async function cancelEntity(
  kind: CancelKind,
  id: string,
  reason: string
): Promise<void> {
  const profile = await getAdminProfile();
  if (profile.role === "field") throw new Error("Sem permissão para cancelar.");
  if (!reason.trim()) throw new Error("Motivo do cancelamento é obrigatório.");

  mutateDb((db) => {
    const entry =
      kind === "sale"
        ? db.sales.find((s) => s.id === id)
        : kind === "expense"
          ? db.expenses.find((e) => e.id === id)
          : kind === "receipt"
            ? db.receipts.find((r) => r.id === id)
            : db.withdrawals.find((w) => w.id === id);
    if (!entry) throw new Error("Lançamento não encontrado.");
    if (entry.status === "canceled") throw new Error("Já está cancelado.");

    const entryDate =
      kind === "sale"
        ? entry.created_at
        : kind === "expense"
          ? (entry as { spent_at: string }).spent_at
          : kind === "receipt"
            ? (entry as { received_at: string }).received_at
            : (entry as { withdrawn_at: string }).withdrawn_at;

    if (isCoveredBySettlement(db, (entry as { point_id: string }).point_id, entryDate)) {
      throw new Error("Período já fechado — lance um ajuste no período aberto.");
    }

    entry.status = "canceled";
    entry.cancel_reason = reason.trim();
    if (kind === "sale") {
      const sale = entry as (typeof db.sales)[number];
      sale.canceled_at = new Date().toISOString();
      sale.canceled_by = profile.id;
    }
  });

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
  const profile = await getAdminProfile();
  const partnerId = req(formData, "partner_id");
  const amount = reqInt(formData, "amount");
  if (amount <= 0) throw new Error("Informe um valor maior que zero.");

  mutateDb((db) => {
    const partner = db.partners.find((p) => p.id === partnerId);
    if (!partner) throw new Error("Sócio não encontrado.");
    if (partner.kind !== "partner") throw new Error("Retirada é só para sócios.");
    const now = new Date().toISOString();
    db.withdrawals.push({
      id: crypto.randomUUID(),
      created_at: now,
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
  });

  revalidatePath("/app/retiradas");
  revalidatePath("/app/financeiro");
  revalidatePath("/app");
}

// ============================================================
// Gasto pelo admin (mesmo form do campo, em desktop)
// ============================================================

export async function createExpenseAdmin(formData: FormData): Promise<void> {
  const profile = await getAdminProfile();
  const pointId = req(formData, "point_id");
  const category = req(formData, "category");
  const amount = reqInt(formData, "amount");
  if (amount <= 0) throw new Error("Informe um valor maior que zero.");
  if (!["diesel", "part_service", "labor", "freight", "other"].includes(category)) {
    throw new Error("Categoria inválida.");
  }

  mutateDb((db) => {
    if (!db.points.some((p) => p.id === pointId)) throw new Error("Ponto não encontrado.");
    const now = new Date().toISOString();
    db.expenses.push({
      id: crypto.randomUUID(),
      created_at: now,
      company_id: profile.company_id,
      point_id: pointId,
      machine_id: opt(formData, "machine_id"),
      category: category as "diesel" | "part_service" | "labor" | "freight" | "other",
      amount,
      liters: opt(formData, "liters") ? Number(opt(formData, "liters")) : null,
      note: opt(formData, "note"),
      photo_url: null,
      spent_at: now,
      created_by: profile.id,
      status: "active",
      cancel_reason: null,
    });
  });

  revalidatePath("/app/gastos");
  revalidatePath("/app/financeiro");
  revalidatePath("/app");
}

// ============================================================
// Fechar acerto (§7.2) — recalcula no confirmar com period_end = agora
// ============================================================

export async function closeSettlement(pointId: string): Promise<string> {
  const profile = await getAdminProfile();
  if (profile.role === "field") throw new Error("Sem permissão.");

  const settlementId = mutateDb((db) => {
    if (!db.points.some((p) => p.id === pointId)) throw new Error("Ponto não encontrado.");
    const start = openPeriodStart(db, pointId);
    const end = new Date().toISOString();
    const calc = computeSettlement(db, pointId, start, end);
    return persistSettlement(db, calc, profile.id);
  });

  revalidatePath("/app/financeiro");
  revalidatePath("/app");
  return settlementId;
}

// ============================================================
// Cadastros (CRUDs enxutos — criar/editar, nunca deletar)
// ============================================================

export async function savePoint(formData: FormData): Promise<void> {
  const profile = await getAdminProfile();
  const id = opt(formData, "id");
  mutateDb((db) => {
    if (id) {
      const point = db.points.find((p) => p.id === id);
      if (!point) throw new Error("Ponto não encontrado.");
      point.name = req(formData, "name");
      point.city = opt(formData, "city");
      const counter = db.point_counters.find((c) => c.point_id === id);
      if (counter) counter.prefix = req(formData, "prefix").toUpperCase();
    } else {
      const pointId = crypto.randomUUID();
      db.points.push({
        id: pointId,
        created_at: new Date().toISOString(),
        company_id: profile.company_id,
        name: req(formData, "name"),
        city: opt(formData, "city"),
      });
      db.point_counters.push({
        point_id: pointId,
        prefix: req(formData, "prefix").toUpperCase(),
        next_no: 1,
      });
    }
  });
  revalidatePath("/app/cadastros");
}

export async function savePartner(formData: FormData): Promise<void> {
  const profile = await getAdminProfile();
  const id = opt(formData, "id");
  const kind = req(formData, "kind") as "partner" | "landowner";
  const percent = kind === "partner" ? Number(req(formData, "percent")) : null;
  const landownerModel =
    kind === "landowner"
      ? (req(formData, "landowner_model") as "revenue_pct" | "fixed")
      : null;
  const landownerValue =
    kind === "landowner" ? reqInt(formData, "landowner_value") : null;

  mutateDb((db) => {
    if (id) {
      const partner = db.partners.find((p) => p.id === id);
      if (!partner) throw new Error("Sócio não encontrado.");
      partner.name = req(formData, "name");
      partner.kind = kind;
      partner.percent = percent;
      partner.landowner_model = landownerModel;
      partner.landowner_value = landownerValue;
    } else {
      db.partners.push({
        id: crypto.randomUUID(),
        created_at: new Date().toISOString(),
        company_id: profile.company_id,
        point_id: req(formData, "point_id"),
        name: req(formData, "name"),
        kind,
        percent,
        landowner_model: landownerModel,
        landowner_value: landownerValue,
      });
    }
  });
  revalidatePath("/app/cadastros");
  revalidatePath("/app/financeiro");
}

export async function saveProduct(formData: FormData): Promise<void> {
  const profile = await getAdminProfile();
  const id = opt(formData, "id");
  mutateDb((db) => {
    if (id) {
      const product = db.products.find((p) => p.id === id);
      if (!product) throw new Error("Produto não encontrado.");
      product.name = req(formData, "name");
      product.price_per_m3 = reqInt(formData, "price_per_m3");
    } else {
      db.products.push({
        id: crypto.randomUUID(),
        created_at: new Date().toISOString(),
        company_id: profile.company_id,
        point_id: req(formData, "point_id"),
        name: req(formData, "name"),
        price_per_m3: reqInt(formData, "price_per_m3"),
      });
    }
  });
  revalidatePath("/app/cadastros");
}

export async function saveVehicle(formData: FormData): Promise<void> {
  const profile = await getAdminProfile();
  const id = opt(formData, "id");
  mutateDb((db) => {
    if (id) {
      const vehicle = db.vehicles.find((v) => v.id === id);
      if (!vehicle) throw new Error("Veículo não encontrado.");
      vehicle.label = req(formData, "label");
      vehicle.plate = opt(formData, "plate");
      vehicle.capacity_m3 = Number(req(formData, "capacity_m3"));
    } else {
      db.vehicles.push({
        id: crypto.randomUUID(),
        created_at: new Date().toISOString(),
        company_id: profile.company_id,
        client_id: null,
        plate: opt(formData, "plate"),
        label: req(formData, "label"),
        capacity_m3: Number(req(formData, "capacity_m3")),
      });
    }
  });
  revalidatePath("/app/cadastros");
}

export async function saveMachine(formData: FormData): Promise<void> {
  const profile = await getAdminProfile();
  const id = opt(formData, "id");
  mutateDb((db) => {
    if (id) {
      const machine = db.machines.find((m) => m.id === id);
      if (!machine) throw new Error("Máquina não encontrada.");
      machine.name = req(formData, "name");
    } else {
      db.machines.push({
        id: crypto.randomUUID(),
        created_at: new Date().toISOString(),
        company_id: profile.company_id,
        point_id: req(formData, "point_id"),
        name: req(formData, "name"),
      });
    }
  });
  revalidatePath("/app/cadastros");
}
