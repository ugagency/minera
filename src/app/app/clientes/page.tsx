import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { listClientsAdmin } from "@/lib/data/admin-queries";
import { formatBRL } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ClientesPage() {
  const clients = listClientsAdmin();

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold">Clientes</h1>
        <p className="text-ink-soft">Saldo devedor e status de crédito</p>
      </header>

      <Card padding="none">
        <Table>
          <THead>
            <TR>
              <TH>Nome</TH>
              <TH>Telefone</TH>
              <TH>Crédito</TH>
              <TH className="text-right">Saldo devedor</TH>
              <TH></TH>
            </TR>
          </THead>
          <TBody>
            {clients.map((c) => (
              <TR key={c.id}>
                <TD className="font-medium">
                  <Link href={`/app/clientes/${c.id}`} className="hover:underline">
                    {c.name}
                  </Link>
                </TD>
                <TD className="text-ink-soft">{c.phone ?? "—"}</TD>
                <TD>
                  {c.credit_enabled ? (
                    <Badge tone="ok">Liberado</Badge>
                  ) : (
                    <Badge tone="neutral">Bloqueado</Badge>
                  )}
                </TD>
                <TD className="text-right">
                  {c.balance > 0 ? (
                    <div className="flex flex-col items-end gap-0.5">
                      <span className="num">{formatBRL(c.balance)}</span>
                      {c.overdue > 0 && (
                        <Badge tone="danger">{formatBRL(c.overdue)} vencido</Badge>
                      )}
                    </div>
                  ) : (
                    <span className="num text-ink-faint">R$ 0,00</span>
                  )}
                </TD>
                <TD>
                  <Link href={`/app/clientes/${c.id}`} className="font-medium text-ink underline">
                    Ver extrato
                  </Link>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </Card>
    </div>
  );
}
