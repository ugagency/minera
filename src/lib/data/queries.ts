import { readDb } from "./db";
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

export function listClients(companyId: string): ClientWithBalance[] {
  const db = readDb();
  return db.clients
    .filter((c) => c.company_id === companyId)
    .map((c) => ({ ...c, balance: clientBalance(db, c.id) }))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

export function listProducts(companyId: string, pointId: string): Product[] {
  const db = readDb();
  return db.products.filter(
    (p) => p.company_id === companyId && p.point_id === pointId
  );
}

export function listVehicles(companyId: string): Vehicle[] {
  const db = readDb();
  return db.vehicles
    .filter((v) => v.company_id === companyId)
    .sort((a, b) => a.capacity_m3 - b.capacity_m3);
}

export function listMachines(companyId: string, pointId: string) {
  const db = readDb();
  return db.machines.filter(
    (m) => m.company_id === companyId && m.point_id === pointId
  );
}

export function listPoints(companyId: string): Point[] {
  const db = readDb();
  return db.points.filter((p) => p.company_id === companyId);
}

/** Total (R$) e m³ vendidos hoje no ponto (vendas active). */
export function todaySummary(pointId: string): { totalCents: number; m3: number } {
  const db = readDb();
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
};

export function getSaleDetails(saleId: string): SaleDetails | null {
  const db = readDb();
  const sale = db.sales.find((s) => s.id === saleId);
  if (!sale) return null;
  const point = db.points.find((p) => p.id === sale.point_id);
  const product = db.products.find((p) => p.id === sale.product_id);
  if (!point || !product) return null;
  const client = sale.client_id
    ? db.clients.find((c) => c.id === sale.client_id) ?? null
    : null;
  const payments = db.sale_payments.filter((p) => p.sale_id === sale.id);
  return { sale, point, product, client, payments };
}
