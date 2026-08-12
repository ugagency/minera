import type { SupabaseClient } from "@supabase/supabase-js";

// Storage real (bucket `photos`, privado — SPEC §6). Grava com o client
// autenticado da requisição, então a RLS do Storage já garante que o objeto
// cai dentro da pasta {company_id}/ do usuário. Retorna o PATH do objeto
// (não a URL) — a exibição sempre passa por URL assinada (ver queries.ts).
export async function savePhoto(
  file: File,
  companyId: string,
  supabase: SupabaseClient
): Promise<string> {
  const ext = extensionFromType(file.type) ?? "jpg";
  const path = `${companyId}/${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage.from("photos").upload(path, file, {
    contentType: file.type || "image/jpeg",
    upsert: false,
  });
  if (error) throw new Error(`Falha ao enviar foto: ${error.message}`);

  return path;
}

function extensionFromType(mime: string): string | null {
  switch (mime) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    default:
      return null;
  }
}
