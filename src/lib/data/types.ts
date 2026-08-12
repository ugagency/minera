// Tipos de domínio — espelham o schema da SPEC-MVP.md §6.
// Dinheiro sempre em centavos (integer). Datas como string ISO (timestamptz).

export type Role = "owner" | "office" | "field";

export type Company = {
  id: string;
  created_at: string;
  name: string;
};

export type Profile = {
  id: string;
  created_at: string;
  company_id: string;
  name: string;
  role: Role;
};

export type Point = {
  id: string;
  created_at: string;
  company_id: string;
  name: string;
  city: string | null;
};

export type PartnerKind = "partner" | "landowner";
export type LandownerModel = "revenue_pct" | "fixed";

export type Partner = {
  id: string;
  created_at: string;
  company_id: string;
  point_id: string;
  name: string;
  kind: PartnerKind;
  percent: number | null;
  landowner_model: LandownerModel | null;
  landowner_value: number | null;
};

export type Machine = {
  id: string;
  created_at: string;
  company_id: string;
  point_id: string;
  name: string;
};

export type Client = {
  id: string;
  created_at: string;
  company_id: string;
  name: string;
  phone: string | null;
  doc: string | null;
  credit_enabled: boolean;
  credit_limit: number;
};

export type Vehicle = {
  id: string;
  created_at: string;
  company_id: string;
  client_id: string | null;
  plate: string | null;
  label: string;
  capacity_m3: number;
};

export type Product = {
  id: string;
  created_at: string;
  company_id: string;
  point_id: string;
  name: string;
  price_per_m3: number;
};

export type EntityStatus = "active" | "canceled";
export type PaymentMethod = "cash" | "pix" | "credit";

export type Sale = {
  id: string;
  created_at: string;
  company_id: string;
  point_id: string;
  product_id: string;
  client_id: string | null;
  qty_m3: number;
  unit_price: number;
  discount_pct: number;
  total: number;
  receipt_no: string;
  status: EntityStatus;
  cancel_reason: string | null;
  canceled_at: string | null;
  canceled_by: string | null;
  photo_url: string | null;
  gps_lat: number | null;
  gps_lng: number | null;
  created_by: string;
};

export type SalePayment = {
  id: string;
  created_at: string;
  sale_id: string;
  method: PaymentMethod;
  amount: number;
};

export type ReceiptMethod = "cash" | "pix" | "transfer";

export type Receipt = {
  id: string;
  created_at: string;
  company_id: string;
  point_id: string;
  client_id: string;
  amount: number;
  method: ReceiptMethod;
  received_at: string;
  note: string | null;
  created_by: string;
  status: EntityStatus;
  cancel_reason: string | null;
};

export type ExpenseCategory =
  | "diesel"
  | "part_service"
  | "labor"
  | "freight"
  | "other";

export type Expense = {
  id: string;
  created_at: string;
  company_id: string;
  point_id: string;
  machine_id: string | null;
  category: ExpenseCategory;
  amount: number;
  liters: number | null;
  note: string | null;
  photo_url: string | null;
  spent_at: string;
  created_by: string;
  status: EntityStatus;
  cancel_reason: string | null;
};

export type Withdrawal = {
  id: string;
  created_at: string;
  company_id: string;
  point_id: string;
  partner_id: string;
  amount: number;
  note: string | null;
  withdrawn_at: string;
  created_by: string;
  status: EntityStatus;
  cancel_reason: string | null;
};

export type ProductionLog = {
  id: string;
  created_at: string;
  company_id: string;
  point_id: string;
  machine_id: string | null;
  log_date: string;
  trips: number | null;
  m3: number;
  created_by: string;
};

export type Settlement = {
  id: string;
  created_at: string;
  company_id: string;
  point_id: string;
  period_start: string;
  period_end: string;
  closed_at: string;
  closed_by: string;
  cash_in: number;
  gross_sales: number;
  expenses_total: number;
  landowner_payout: number;
  profit_pool: number;
  snapshot: unknown;
};

export type SettlementLine = {
  id: string;
  created_at: string;
  settlement_id: string;
  partner_id: string;
  partner_name: string;
  kind: PartnerKind;
  base_amount: number;
  withdrawals_total: number;
  final_amount: number;
};

export type PointCounter = {
  point_id: string;
  prefix: string;
  next_no: number;
};

export type Db = {
  companies: Company[];
  profiles: Profile[];
  points: Point[];
  partners: Partner[];
  machines: Machine[];
  clients: Client[];
  vehicles: Vehicle[];
  products: Product[];
  sales: Sale[];
  sale_payments: SalePayment[];
  receipts: Receipt[];
  expenses: Expense[];
  withdrawals: Withdrawal[];
  production_logs: ProductionLog[];
  settlements: Settlement[];
  settlement_lines: SettlementLine[];
  point_counters: PointCounter[];
};
