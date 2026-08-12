import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { SaleDetailModal } from "@/components/app/SaleDetailModal";
import { listSalesAdmin } from "@/lib/data/admin-queries";
import { readDb } from "@/lib/data/db";
import { formatBRL, formatM3 } from "@/lib/format";
import { PAYMENT_METHOD_LABELS } from "@/lib/labels";
import type { PaymentMethod } from "@/lib/data/types";

export const dynamic = "force-dynamic";

type SearchParams = {
  point?: string;
  client?: string;
  method?: string;
  from?: string;
  to?: string;
};

export default async function VendasPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const db = await readDb();
  const sales = await listSalesAdmin({
    pointId: sp.point || undefined,
    clientId: sp.client || undefined,
    method: (sp.method as PaymentMethod) || undefined,
    from: sp.from || undefined,
    to: sp.to || undefined,
  });

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold">Vendas</h1>
        <p className="text-ink-soft">{sales.length} venda(s) no filtro atual</p>
      </header>

      <Card>
        <form className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5" method="get">
          <Field label="Ponto">
            <select name="point" defaultValue={sp.point ?? ""} className="fld">
              <option value="">Todos</option>
              {db.points.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Cliente">
            <select name="client" defaultValue={sp.client ?? ""} className="fld">
              <option value="">Todos</option>
              {db.clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Pagamento">
            <select name="method" defaultValue={sp.method ?? ""} className="fld">
              <option value="">Todos</option>
              <option value="cash">Dinheiro</option>
              <option value="pix">PIX</option>
              <option value="credit">Fiado</option>
            </select>
          </Field>
          <Field label="De">
            <input type="date" name="from" defaultValue={sp.from ?? ""} className="fld" />
          </Field>
          <Field label="Até">
            <input type="date" name="to" defaultValue={sp.to ?? ""} className="fld" />
          </Field>
          <div className="col-span-2 flex items-end sm:col-span-3 lg:col-span-5">
            <button
              type="submit"
              className="h-11 rounded-control bg-sand px-5 text-[15px] font-semibold text-ink hover:bg-sand-deep"
            >
              Filtrar
            </button>
          </div>
        </form>
      </Card>

      <Card padding="none">
        <Table>
          <THead>
            <TR>
              <TH>Recibo</TH>
              <TH>Data</TH>
              <TH>Ponto</TH>
              <TH>Cliente</TH>
              <TH>Produto</TH>
              <TH className="text-right">Qtd</TH>
              <TH className="text-right">Total</TH>
              <TH>Pagamento</TH>
              <TH>Status</TH>
            </TR>
          </THead>
          <TBody>
            {sales.length === 0 ? (
              <TR>
                <TD colSpan={9} className="text-center text-ink-faint">
                  Nenhuma venda encontrada.
                </TD>
              </TR>
            ) : (
              sales.map((s) => (
                <TR key={s.id} className={s.status === "canceled" ? "opacity-60" : ""}>
                  <TD>
                    <SaleDetailModal sale={s} />
                  </TD>
                  <TD className="whitespace-nowrap text-ink-soft">
                    {new Date(s.created_at).toLocaleString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </TD>
                  <TD className="text-ink-soft">{s.pointName}</TD>
                  <TD>{s.clientName}</TD>
                  <TD>{s.productName}</TD>
                  <TD className="num text-right">{formatM3(s.qty_m3)}</TD>
                  <TD className="num text-right">{formatBRL(s.total)}</TD>
                  <TD>
                    <div className="flex flex-wrap gap-1">
                      {s.payments.map((p) => (
                        <Badge key={p.id} tone={p.method === "credit" ? "neutral" : "ok"}>
                          {PAYMENT_METHOD_LABELS[p.method]}
                        </Badge>
                      ))}
                    </div>
                  </TD>
                  <TD>
                    {s.status === "canceled" ? (
                      <Badge tone="danger">Cancelada</Badge>
                    ) : (
                      <Badge tone="ok">Ativa</Badge>
                    )}
                  </TD>
                </TR>
              ))
            )}
          </TBody>
        </Table>
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-medium text-ink-soft">
      {label}
      {children}
    </label>
  );
}
