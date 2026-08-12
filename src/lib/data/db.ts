import fs from "node:fs";
import path from "node:path";
import type { Db } from "./types";
import {
  buildSeedDb,
  SEED_VERSION,
  COMPANY_ID,
  OWNER_PROFILE_ID,
  OFFICE_PROFILE_ID,
  FIELD_PROFILE_ID,
  POINT_AREAL_ID,
  POINT_SAIBREIRA_ID,
} from "./seed";
import { computeSettlement, openPeriodStart, persistSettlement } from "./settlement";

// Data layer mock (sem Supabase até o fim do projeto): JSON em disco com a
// mesma forma do schema real (SPEC §6). Para resetar os dados de demo,
// apague .data/db.json.

const DB_PATH = path.join(process.cwd(), ".data", "db.json");

type VersionedDb = Db & { _seed_version?: number };

function createSeededDb(): VersionedDb {
  const db = buildSeedDb() as VersionedDb;

  // 1 acerto já fechado por ponto (SPEC §10): cobre os primeiros ~30 dias,
  // deixando o período atual aberto com números vivos.
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  cutoff.setHours(23, 59, 59, 999);
  const periodEnd = cutoff.toISOString();

  for (const pointId of [POINT_AREAL_ID, POINT_SAIBREIRA_ID]) {
    const start = openPeriodStart(db, pointId);
    const calc = computeSettlement(db, pointId, start, periodEnd);
    persistSettlement(db, calc, OWNER_PROFILE_ID);
    // closed_at coerente com o fim do período (não "agora")
    const settlement = db.settlements[db.settlements.length - 1];
    if (settlement) settlement.closed_at = periodEnd;
  }

  db._seed_version = SEED_VERSION;
  return db;
}

function ensureDbFile(): void {
  if (fs.existsSync(DB_PATH)) {
    try {
      const existing = JSON.parse(fs.readFileSync(DB_PATH, "utf-8")) as VersionedDb;
      if ((existing._seed_version ?? 0) >= SEED_VERSION) return;
    } catch {
      // arquivo corrompido → regenera
    }
  }
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  fs.writeFileSync(DB_PATH, JSON.stringify(createSeededDb(), null, 2), "utf-8");
}

export function readDb(): Db {
  ensureDbFile();
  const raw = fs.readFileSync(DB_PATH, "utf-8");
  return JSON.parse(raw) as Db;
}

export function writeDb(db: Db): void {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), "utf-8");
}

/** Lê, aplica a mutação e grava — uso padrão nas Server Actions. */
export function mutateDb<T>(fn: (db: Db) => T): T {
  const db = readDb();
  const result = fn(db);
  writeDb(db);
  return result;
}

export const SEED_IDS = {
  COMPANY_ID,
  OWNER_PROFILE_ID,
  OFFICE_PROFILE_ID,
  FIELD_PROFILE_ID,
  POINT_AREAL_ID,
  POINT_SAIBREIRA_ID,
};
