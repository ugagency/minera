import { createClient } from "@/lib/supabase/server";
import type { Db } from "./types";

// Data layer real (Supabase/Postgres). readDb() busca as tabelas relevantes
// com o client autenticado da requisição — RLS já escopa tudo por empresa
// automaticamente. Mantém a MESMA forma (Db) que a versão mock usava, então
// toda a lógica pura em queries.ts / admin-queries.ts / settlement.ts
// continua igual, só ganhou `await` nas chamadas.
//
// Volume da demo (~1-2 mil linhas nas maiores tabelas) é pequeno o bastante
// para trazer tudo de uma vez com poucas queries em paralelo; não pagina.

const TABLES = [
  "companies",
  "profiles",
  "points",
  "partners",
  "machines",
  "clients",
  "vehicles",
  "products",
  "sales",
  "sale_payments",
  "receipts",
  "expenses",
  "withdrawals",
  "production_logs",
  "settlements",
  "settlement_lines",
  "point_counters",
] as const;

export async function readDb(): Promise<Db> {
  const supabase = await createClient();

  const results = await Promise.all(
    TABLES.map((table) => supabase.from(table).select("*"))
  );

  const db = {} as Db;
  TABLES.forEach((table, i) => {
    const { data, error } = results[i]!;
    if (error) {
      throw new Error(`Falha ao ler '${table}' do Supabase: ${error.message}`);
    }
    // @ts-expect-error — montagem dinâmica da mesma forma de Db
    db[table] = data ?? [];
  });

  return db;
}
