// Tipagem mínima do schema para o client Supabase (mapeia SPEC §6 / src/lib/data/types.ts).
// Gerada à mão (não via `supabase gen types`) para não depender da CLI nesta fase.

import type {
  Client,
  Company,
  Expense,
  Machine,
  Partner,
  Point,
  PointCounter,
  Product,
  Profile,
  ProductionLog,
  Receipt,
  Sale,
  SalePayment,
  Settlement,
  SettlementLine,
  Vehicle,
  Withdrawal,
} from "@/lib/data/types";

type Table<Row, Insert, Update = Partial<Insert>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

type Rowless<T> = Omit<T, "id" | "created_at"> & { id?: string; created_at?: string };

export type Database = {
  public: {
    Tables: {
      companies: Table<Company, Rowless<Company>>;
      profiles: Table<Profile, Rowless<Profile> & { id: string }>;
      points: Table<Point, Rowless<Point>>;
      partners: Table<Partner, Rowless<Partner>>;
      machines: Table<Machine, Rowless<Machine>>;
      clients: Table<Client, Rowless<Client>>;
      vehicles: Table<Vehicle, Rowless<Vehicle>>;
      products: Table<Product, Rowless<Product>>;
      sales: Table<Sale, Rowless<Sale>>;
      sale_payments: Table<SalePayment, Rowless<SalePayment>>;
      receipts: Table<Receipt, Rowless<Receipt>>;
      expenses: Table<Expense, Rowless<Expense>>;
      withdrawals: Table<Withdrawal, Rowless<Withdrawal>>;
      production_logs: Table<ProductionLog, Rowless<ProductionLog>>;
      settlements: Table<Settlement, Rowless<Settlement>>;
      settlement_lines: Table<SettlementLine, Rowless<SettlementLine>>;
      point_counters: Table<PointCounter, PointCounter>;
    };
    Views: Record<string, never>;
    Functions: {
      current_company_id: { Args: Record<string, never>; Returns: string };
      create_sale: {
        Args: {
          p_point_id: string;
          p_product_id: string;
          p_client_id: string | null;
          p_qty_m3: number;
          p_unit_price: number;
          p_total: number;
          p_photo_url: string | null;
          p_gps_lat: number | null;
          p_gps_lng: number | null;
          p_payments: Array<{ method: string; amount: number }>;
        };
        Returns: { id: string; receipt_no: string }[];
      };
      close_settlement: {
        Args: {
          p_point_id: string;
          p_period_start: string;
          p_period_end: string;
          p_cash_in: number;
          p_gross_sales: number;
          p_expenses_total: number;
          p_landowner_payout: number;
          p_profit_pool: number;
          p_snapshot: unknown;
          p_lines: Array<{
            partner_id: string;
            partner_name: string;
            kind: string;
            base_amount: number;
            withdrawals_total: number;
            final_amount: number;
          }>;
        };
        Returns: { id: string }[];
      };
    };
  };
};
