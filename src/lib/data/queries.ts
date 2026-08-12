import { readDb } from "./db";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Client, Db, Point, Product, Sale, Vehicle } from "./types";

/** Saldo devedor do cliente: Σ sale_payments.credit (vendas active) − Σ receipts.active. */
export function clientBalance(db: Db, clientId: string): number {
  const creditTotal = db.sales
    .filter((s) => s.client_id === clientId && s.status === "active")
    .flatMap((s) => db.sale_payments.filter((p) => p.sale_id === s.id))
    .filter((p) => p.method === "credit")
    .reduce((sum, p) => sum + p.amount, 0);

  const receivedTotal = db.receipts
    .filter((r) => r.client_id === clientId && r.status === "active")
    .reduce((sum, r) => sum + r.amount, 0);

  return creditTotal - receivedTotal;
}

export type ClientWithBalance = Client & { balance: number };

export async function listClients(companyId: string): Promise<ClientWithBalance[]> {
  const db = await readDb();
  return db.clients
    .filter((c) => c.company_id === companyId)
    .map((c) => ({ ...c, balance: clientBalance(db, c.id) }))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

export async function listProducts(companyId: string, pointId: string): Promise<Product[]> {
  const db = await readDb();
  return db.products.filter(
    (p) => p.company_id === companyId && p.point_id === pointId
  );
}

export async function listVehicles(companyId: string): Promise<Vehicle[]> {
  const db = await readDb();
  return db.vehicles
    .filter((v) => v.company_id === companyId)
    .sort((a, b) => a.capacity_m3 - b.capacity_m3);
}

export async function listMachines(companyId: string, pointId: string) {
  const db = await readDb();
  return db.machines.filter(
    (m) => m.company_id === companyId && m.point_id === pointId
  );
}

export async function listPoints(companyId: string): Promise<Point[]> {
  const db = await readDb();
  return db.points.filter((p) => p.company_id === companyId);
}

/** Total (R$) e m³ vendidos hoje no ponto (vendas active). */
export async function todaySummary(pointId: string): Promise<{ totalCents: number; m3: number }> {
  const db = await readDb();
  const todayKey = new Date().toDateString();
  const sales = db.sales.filter(
    (s) =>
      s.point_id === pointId &&
      s.status === "active" &&
      new Date(s.created_at).toDateString() === todayKey
  );
  return {
    totalCents: sales.reduce((sum, s) => sum + s.total, 0),
    m3: sales.reduce((sum, s) => sum + s.qty_m3, 0),
  };
}

export type SaleDetails = {
  sale: Sale;
  point: Point;
  product: Product;
  client: Client | null;
  payments: Db["sale_payments"];
  photoSignedUrl: string | null;
};

/**
 * Usada pela página pública do recibo (/r/[saleId]) — SEM sessão de usuário,
 * então lê com a service role (RLS não se aplica; expõe só os campos do
 * recibo, nunca a lista completa de vendas da empresa).
 */
export async function getSaleDetails(saleId: string): Promise<SaleDetails | null> {
  const supabase = createAdminClient();

  const { data: sale } = await supabase.from("sales").select("*").eq("id", saleId).maybeSingle();
  if (!sale) return null;

  const [{ data: point }, { data: product }, { data: payments }] = await Promise.all([
    supabase.from("points").select("*").eq("id", sale.point_id).maybeSingle(),
    supabase.from("products").select("*").eq("id", sale.product_id).maybeSingle(),
    supabase.from("sale_payments").select("*").eq("sale_id", sale.id),
  ]);
  if (!point || !product) return null;

  const client = sale.client_id
    ? (await supabase.from("clients").select("*").eq("id", sale.client_id).maybeSingle()).data
    : null;

  let photoSignedUrl: string | null = null;
  if (sale.photo_url) {
    const { data } = await supabase.storage
      .from("photos")
      .createSignedUrl(sale.photo_url, 60 * 60);
    photoSignedUrl = data?.signedUrl ?? null;
  }

  return { sale, point, product, client: client ?? null, payments: payments ?? [], photoSignedUrl };
}
