import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

/**
 * Client com a service_role key — ignora RLS. Uso restrito a:
 * - página pública do recibo (/r/[saleId]), que não tem sessão de usuário;
 * - scripts/seed.ts (precisa criar dados de outras empresas/usuários);
 * - geração de URL assinada de fotos para exibição pública.
 * NUNCA importar este módulo em Client Components.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY ausente — configure .env.local");
  }
  return createSupabaseClient<Database>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
