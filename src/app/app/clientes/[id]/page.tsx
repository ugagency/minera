import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardLabel } from "@/components/ui/Card";
import { IconPrint } from "@/components/ui/Icon";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { ReceiptModal } from "@/components/app/ReceiptModal";
import { ToggleCreditButton } from "@/components/app/ToggleCreditButton";
import { clientStatement } from "@/lib/data/admin-queries";
import { readDb } from "@/lib/data/db";
import { formatBRL } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ClienteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const statement = await clientStatement(id);
  if (!statement) notFound();
  const { client, rows, balance } = statement;
  const points = (await readDb()).points;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <Link href="/app/clientes" className="text-sm text-ink-faint hover:text-ink">
          ← Clientes
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">{client.name}</h1>
            <p className="text-ink-soft">{client.phone ?? "sem telefone"}</p>
          </div>
          <div className="flex items-center gap-2">
            {client.credit_enabled ? (
              <Badge tone="ok">Crédito liberado</Badge>
            ) : (
              <Badge tone="neutral">Crédito bloqueado</Badge>
            )}
          </div>
        </div>
      </header>

      <Card variant={balance > 0 ? "tint" : "default"} className="flex items-center justify-between">
        <div>
          <CardLabel>Saldo devedor</CardLabel>
          <div className="num-strong text-2xl">{formatBRL(Math.max(0, balance))}</div>
        </div>
        {client.credit_limit > 0 && (
          <div className="text-right text-sm text-ink-soft">
            Limite: <span className="num">{formatBRL(client.credit_limit)}</span>
          </div>
        )}
      </Card>

      {/* 3 ações de 1 clique (§8) */}
      <div className="flex flex-wrap gap-3">
        <ReceiptModal
          clientId={client.id}
          points={points}
          trigger={<Button variant="primary">Lançar recebimento</Button>}
        />
        <ToggleCreditButton clientId={client.id} enabled={client.credit_enabled} />
        <Link href={`/print/extrato/${client.id}`} target="_blank">
          <Button variant="ghost">
            <IconPrint size={18} /> Extrato para imprimir
          </Button>
        </Link>
      </div>

      <Card padding="none">
        <Table>
          <THead>
            <TR>
              <TH>Data</TH>
              <TH>Descrição</TH>
              <TH>Ponto</TH>
              <TH className="text-right">Valor</TH>
              <TH className="text-right">Saldo</TH>
            </TR>
          </THead>
          <TBody>
            {rows.length === 0 ? (
              <TR>
                <TD colSpan={5} className="text-center text-ink-faint">
                  Sem movimentação.
                </TD>
              </TR>
            ) : (
              rows.map((r, i) => (
                <TR key={i}>
                  <TD className="whitespace-nowrap text-ink-soft">
                    {format(new Date(r.at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  </TD>
                  <TD>{r.description}</TD>
                  <TD className="text-ink-soft">{r.pointName}</TD>
                  <TD className={`num text-right ${r.delta < 0 ? "text-ok" : ""}`}>
                    {r.delta >= 0 ? "+" : ""}
                    {formatBRL(r.delta)}
                  </TD>
                  <TD className="num text-right">{formatBRL(r.balance)}</TD>
                </TR>
              ))
            )}
          </TBody>
        </Table>
      </Card>
    </div>
  );
}
