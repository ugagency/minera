import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "./types";

/**
 * Client Supabase para Server Components/Actions/Route Handlers — usa a
 * sessão do cookie do usuário logado, então toda leitura/escrita já respeita
 * RLS automaticamente (escopo por company_id via current_company_id()).
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // chamado de um Server Component sem permissão de escrita — o
            // middleware já cuida de refrescar a sessão nesse caso.
          }
        },
      },
    }
  );
}
