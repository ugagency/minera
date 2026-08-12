// Dinheiro em centavos (integer) no banco; formatar só na borda da UI.

const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const numberPtBr = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

/** Formata centavos como R$ 1.234,56 */
export function formatBRL(cents: number): string {
  return brl.format(cents / 100);
}

/** Formata quantidade em m³ (ex.: 12,5 m³) */
export function formatM3(m3: number): string {
  return `${numberPtBr.format(m3)} m³`;
}
