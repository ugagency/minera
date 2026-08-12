import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { CancelModal } from "@/components/app/CancelModal";
import { WithdrawalForm } from "@/components/app/WithdrawalForm";
import { listWithdrawalsAdmin } from "@/lib/data/admin-queries";
import { readDb } from "@/lib/data/db";
import { formatBRL } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function RetiradasPage() {
  const db = readDb();
  const partners = db.partners.filter((p) => p.kind === "partner");
  const withdrawals = listWithdrawalsAdmin();

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold">Retiradas</h1>
        <p className="text-ink-soft">Vales e adiantamentos dos sócios</p>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[360px_1fr]">
        <WithdrawalForm partners={partners} />

        <Card padding="none">
          <Table>
            <THead>
              <TR>
                <TH>Data</TH>
                <TH>Ponto</TH>
                <TH>Sócio</TH>
                <TH>Observação</TH>
                <TH className="text-right">Valor</TH>
                <TH>Status</TH>
                <TH></TH>
              </TR>
            </THead>
            <TBody>
              {withdrawals.length === 0 ? (
                <TR>
                  <TD colSpan={7} className="text-center text-ink-faint">
                    Nenhuma retirada lançada.
                  </TD>
                </TR>
              ) : (
                withdrawals.map((w) => (
                  <TR key={w.id} className={w.status === "canceled" ? "opacity-60" : ""}>
                    <TD className="whitespace-nowrap text-ink-soft">
                      {new Date(w.withdrawn_at).toLocaleDateString("pt-BR")}
                    </TD>
                    <TD className="text-ink-soft">{w.pointName}</TD>
                    <TD>{w.partnerName}</TD>
                    <TD className="text-ink-soft">{w.note ?? "—"}</TD>
                    <TD className="num text-right">{formatBRL(w.amount)}</TD>
                    <TD>
                      {w.status === "canceled" ? (
                        <Badge tone="danger">Cancelada</Badge>
                      ) : (
                        <Badge tone="ok">Ativa</Badge>
                      )}
                    </TD>
                    <TD>
                      {w.canCancel && (
                        <CancelModal
                          kind="withdrawal"
                          id={w.id}
                          trigger={
                            <button className="text-sm font-medium text-danger underline">
                              Cancelar
                            </button>
                          }
                        />
                      )}
                    </TD>
                  </TR>
                ))
              )}
            </TBody>
          </Table>
        </Card>
      </div>
    </div>
  );
}
