import { cookies } from "next/headers";
import { readDb } from "./data/db";
import { SEED_IDS } from "./data/db";
import type { Point, Profile } from "./data/types";

// Sessão mock (sem auth ainda — F1 troca isto por Supabase Auth + profiles).
// O usuário de campo do seed é fixo; o "ponto ativo" fica num cookie porque
// profiles não têm point_id no schema (o field acessa os pontos da empresa).

const ACTIVE_POINT_COOKIE = "mp_active_point";

export async function getCurrentProfile(): Promise<Profile> {
  const db = readDb();
  const profile = db.profiles.find((p) => p.id === SEED_IDS.FIELD_PROFILE_ID);
  if (!profile) throw new Error("Perfil de campo do seed não encontrado.");
  return profile;
}

/** Perfil admin mock para as rotas /app (owner). Some quando a auth real entrar. */
export async function getAdminProfile(): Promise<Profile> {
  const db = readDb();
  const profile = db.profiles.find((p) => p.id === SEED_IDS.OWNER_PROFILE_ID);
  if (!profile) throw new Error("Perfil owner do seed não encontrado.");
  return profile;
}

export async function getActivePoint(): Promise<Point> {
  const db = readDb();
  const jar = await cookies();
  const cookiePointId = jar.get(ACTIVE_POINT_COOKIE)?.value;
  const byCookie = db.points.find((p) => p.id === cookiePointId);
  if (byCookie) return byCookie;
  const first = db.points[0];
  if (!first) throw new Error("Nenhum ponto cadastrado.");
  return first;
}

export { ACTIVE_POINT_COOKIE };
