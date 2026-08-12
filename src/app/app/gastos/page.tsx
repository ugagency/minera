import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { CancelModal } from "@/components/app/CancelModal";
import { ExpenseFormAdmin } from "@/components/app/ExpenseFormAdmin";
import { listExpensesAdmin } from "@/lib/data/admin-queries";
import { readDb } from "@/lib/data/db";
import { formatBRL } from "@/lib/format";
import { EXPENSE_CATEGORY_LABELS } from "@/lib/labels";

export const dynamic = "force-dynamic";

export default async function GastosPage() {
  const db = await readDb();
  const expenses = await listExpensesAdmin();

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold">Gastos</h1>
        <p className="text-ink-soft">Diesel, peças, mão de obra, frete e outros</p>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[360px_1fr]">
        <ExpenseFormAdmin points={db.points} machines={db.machines} />

        <Card padding="none">
          <Table>
            <THead>
              <TR>
                <TH>Data</TH>
                <TH>Ponto</TH>
                <TH>Categoria</TH>
                <TH>Máquina</TH>
                <TH className="text-right">Valor</TH>
                <TH>Status</TH>
                <TH></TH>
              </TR>
            </THead>
            <TBody>
              {expenses.length === 0 ? (
                <TR>
                  <TD colSpan={7} className="text-center text-ink-faint">
                    Nenhum gasto lançado.
                  </TD>
                </TR>
              ) : (
                expenses.map((e) => (
                  <TR key={e.id} className={e.status === "canceled" ? "opacity-60" : ""}>
                    <TD className="whitespace-nowrap text-ink-soft">
                      {new Date(e.spent_at).toLocaleDateString("pt-BR")}
                    </TD>
                    <TD className="text-ink-soft">{e.pointName}</TD>
                    <TD>
                      {EXPENSE_CATEGORY_LABELS[e.category]}
                      {e.liters ? ` · ${e.liters} L` : ""}
                    </TD>
                    <TD className="text-ink-soft">{e.machineName ?? "—"}</TD>
                    <TD className="num text-right">{formatBRL(e.amount)}</TD>
                    <TD>
                      {e.status === "canceled" ? (
                        <Badge tone="danger">Cancelado</Badge>
                      ) : (
                        <Badge tone="ok">Ativo</Badge>
                      )}
                    </TD>
                    <TD>
                      {e.canCancel && (
                        <CancelModal
                          kind="expense"
                          id={e.id}
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
