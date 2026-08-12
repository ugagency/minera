// Conversão entre centavos (estado/banco) e string editável em pt-BR ("1234,56").

export function centsToDecimalString(cents: number): string {
  const abs = Math.abs(cents);
  const reais = Math.floor(abs / 100);
  const centavos = String(abs % 100).padStart(2, "0");
  const sign = cents < 0 ? "-" : "";
  return `${sign}${reais},${centavos}`;
}

export function decimalStringToCents(input: string): number {
  const normalized = input
    .trim()
    .replace(/[^\d,.-]/g, "")
    .replace(/\.(?=\d{3}(?:\D|$))/g, "") // remove separador de milhar
    .replace(",", ".");
  const value = Number.parseFloat(normalized);
  if (Number.isNaN(value)) return 0;
  return Math.round(value * 100);
}
