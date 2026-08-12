import { notFound } from "next/navigation";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PrintButton } from "@/components/app/PrintButton";
import { clientStatement } from "@/lib/data/admin-queries";
import { formatBRL } from "@/lib/format";
import { RECEIPT_FOOTER } from "@/lib/config";

export default async function ExtratoPrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ clientId: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { clientId } = await params;
  const { from, to } = await searchParams;
  const statement = clientStatement(clientId, from, to);
  if (!statement) notFound();
  const { client, rows, balance } = statement;

  return (
    <div className="mx-auto max-w-3xl px-8 py-10 print:px-0 print:py-0">
      <div className="mb-6 flex items-center justify-between print:hidden">
        <PrintButton />
      </div>

      <header className="mb-6 flex items-start justify-between border-b border-line pb-4">
        <div>
          <h1 className="text-xl font-bold">Extrato de cliente</h1>
          <p className="text-ink-soft">{client.name}</p>
          {client.phone && <p className="text-sm text-ink-faint">{client.phone}</p>}
        </div>
        <div className="text-right text-sm text-ink-faint">
          Emitido em {format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })}
        </div>
      </header>

      <table className="w-full border-collapse text-[14px]">
        <thead>
          <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-faint">
            <th className="py-2 pr-2">Data</th>
            <th className="py-2 pr-2">Descrição</th>
            <th className="py-2 pr-2">Ponto</th>
            <th className="py-2 pr-2 text-right">Valor</th>
            <th className="py-2 text-right">Saldo</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-line">
              <td className="whitespace-nowrap py-2 pr-2 text-ink-soft">
                {format(new Date(r.at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
              </td>
              <td className="py-2 pr-2">{r.description}</td>
              <td className="py-2 pr-2 text-ink-soft">{r.pointName}</td>
              <td className="num py-2 pr-2 text-right">
                {r.delta >= 0 ? "+" : ""}
                {formatBRL(r.delta)}
              </td>
              <td className="num py-2 text-right">{formatBRL(r.balance)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-4 flex justify-end border-t border-line pt-4">
        <div className="text-right">
          <div className="text-sm text-ink-faint">Saldo devedor atual</div>
          <div className="num-strong text-xl">{formatBRL(Math.max(0, balance))}</div>
        </div>
      </div>

      <p className="mt-10 text-center text-xs text-ink-faint">{RECEIPT_FOOTER}</p>
    </div>
  );
}
