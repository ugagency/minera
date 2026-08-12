import { notFound } from "next/navigation";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PrintButton } from "@/components/app/PrintButton";
import { getSettlement } from "@/lib/data/admin-queries";
import { formatBRL } from "@/lib/format";
import { RECEIPT_FOOTER } from "@/lib/config";

export default async function AcertoPrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const settlement = await getSettlement(id);
  if (!settlement) notFound();

  return (
    <div className="mx-auto max-w-3xl px-8 py-10 print:px-0 print:py-0">
      <div className="mb-6 flex items-center justify-between print:hidden">
        <PrintButton />
      </div>

      <header className="mb-6 border-b border-line pb-4">
        <h1 className="text-xl font-bold">Acerto — {settlement.pointName}</h1>
        <p className="text-ink-soft">
          Período: {format(new Date(settlement.period_start), "dd/MM/yyyy HH:mm", { locale: ptBR })} até{" "}
          {format(new Date(settlement.period_end), "dd/MM/yyyy HH:mm", { locale: ptBR })}
        </p>
        <p className="text-sm text-ink-faint">
          Fechado em {format(new Date(settlement.closed_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
        </p>
      </header>

      <section className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Kpi label="Entradas (caixa)" value={settlement.cash_in} />
        <Kpi label="Vendas brutas" value={settlement.gross_sales} />
        <Kpi label="Gastos" value={settlement.expenses_total} />
        <Kpi label="Dono do terreno" value={settlement.landowner_payout} />
      </section>

      <section className="mb-6 flex items-baseline justify-between border-y border-line py-3">
        <span className="font-semibold">Lucro dividido entre sócios</span>
        <span className="num-strong text-xl">{formatBRL(settlement.profit_pool)}</span>
      </section>

      <table className="w-full border-collapse text-[14px]">
        <thead>
          <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-faint">
            <th className="py-2 pr-2">Sócio / dono do terreno</th>
            <th className="py-2 pr-2 text-right">Base</th>
            <th className="py-2 pr-2 text-right">Retiradas</th>
            <th className="py-2 text-right">Valor final</th>
          </tr>
        </thead>
        <tbody>
          {settlement.lines.map((l) => (
            <tr key={l.id} className="border-b border-line">
              <td className="py-2 pr-2">
                {l.partner_name} {l.kind === "landowner" ? "(terreno)" : ""}
              </td>
              <td className="num py-2 pr-2 text-right">{formatBRL(l.base_amount)}</td>
              <td className="num py-2 pr-2 text-right">{formatBRL(l.withdrawals_total)}</td>
              <td className="num py-2 text-right font-semibold">{formatBRL(l.final_amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="mt-10 text-center text-xs text-ink-faint">{RECEIPT_FOOTER}</p>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-ink-faint">{label}</div>
      <div className="num-strong text-lg">{formatBRL(value)}</div>
    </div>
  );
}
