import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import type { Point, Profile } from "./data/types";

// Sessão real via Supabase Auth. O middleware já garante que só chega aqui
// quem está logado (exceto rotas públicas). "Ponto ativo" continua em cookie
// porque profiles não têm point_id no schema (o usuário acessa os pontos da
// empresa toda; ver SPEC §6).

const ACTIVE_POINT_COOKIE = "mp_active_point";

export async function getCurrentProfile(): Promise<Profile> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado.");

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();
  if (error || !profile) throw new Error("Perfil não encontrado.");
  return profile;
}

export async function getActivePoint(): Promise<Point> {
  const supabase = await createClient();
  const jar = await cookies();
  const cookiePointId = jar.get(ACTIVE_POINT_COOKIE)?.value;

  if (cookiePointId) {
    const { data } = await supabase
      .from("points")
      .select("*")
      .eq("id", cookiePointId)
      .maybeSingle();
    if (data) return data;
  }

  const { data: points, error } = await supabase
    .from("points")
    .select("*")
    .order("name")
    .limit(1);
  if (error || !points?.[0]) throw new Error("Nenhum ponto cadastrado.");
  return points[0];
}

export { ACTIVE_POINT_COOKIE };
