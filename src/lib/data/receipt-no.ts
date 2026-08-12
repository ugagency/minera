import type { Db } from "./types";

// Sequencial por ponto via point_counters (SPEC §7.4). No Postgres real isto
// é `select ... for update` na transação da venda; aqui a mutação acontece
// dentro de mutateDb() (readDb → muta → writeDb), que já serializa as
// escritas por ser síncrono no processo do servidor.
export function nextReceiptNo(db: Db, pointId: string): string {
  const counter = db.point_counters.find((c) => c.point_id === pointId);
  if (!counter) {
    throw new Error("Ponto sem contador de recibo (point_counters).");
  }
  const no = counter.next_no;
  counter.next_no += 1;
  const padded = String(no).padStart(6, "0");
  return `${counter.prefix}-${padded}`;
}
