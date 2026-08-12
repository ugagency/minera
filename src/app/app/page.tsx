import { Badge } from "@/components/ui/Badge";
import { Card, CardLabel } from "@/components/ui/Card";
import { IconWarning } from "@/components/ui/Icon";
import { dashboardData } from "@/lib/data/admin-queries";
import { EXPENSE_CATEGORY_LABELS } from "@/lib/labels";
import { formatBRL, formatM3 } from "@/lib/format";
import type { ExpenseCategory } from "@/lib/data/types";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const data = await dashboardData();

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-ink-soft">Visão geral dos pontos</p>
      </header>

      {/* KPIs por ponto */}
      <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {data.points.map((k) => (
          <Card key={k.point.id} className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="font-bold">{k.point.name}</h2>
              {k.deviationPct !== null && Math.abs(k.deviationPct) > 5 ? (
                <Badge tone="attention">
                  desvio {k.deviationPct.toFixed(0)}%
                </Badge>
              ) : null}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <CardLabel>Hoje</CardLabel>
                <div className="num-strong text-xl">{formatBRL(k.todayCents)}</div>
                <div className="text-sm text-ink-soft">{formatM3(k.todayM3)}</div>
              </div>
              <div>
                <CardLabel>Mês</CardLabel>
                <div className="num-strong text-xl">{formatBRL(k.monthCents)}</div>
                <div className="text-sm text-ink-soft">{formatM3(k.monthM3)}</div>
              </div>
            </div>
            <ProductionVsSales
              produced={k.producedMonthM3}
              sold={k.soldMonthM3}
              deviationPct={k.deviationPct}
            />
          </Card>
        ))}
      </section>

      {/* KPIs gerais */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card>
          <CardLabel>A receber</CardLabel>
          <div className="num-strong mt-1 text-xl">{formatBRL(data.receivableTotal)}</div>
          {data.overdueTotal > 0 ? (
            <div className="mt-1">
              <Badge tone="danger">{formatBRL(data.overdueTotal)} vencido</Badge>
            </div>
          ) : (
            <div className="mt-1 text-sm text-ink-soft">nada vencido</div>
          )}
        </Card>
        <Card>
          <CardLabel>Gasto do mês</CardLabel>
          <div className="num-strong mt-1 text-xl">{formatBRL(data.monthExpenses)}</div>
          <div className="mt-1 text-sm text-ink-soft">
            {topCategory(data.monthExpensesByCategory)}
          </div>
        </Card>
        <Card>
          <CardLabel>Retiradas do mês</CardLabel>
          <div className="num-strong mt-1 text-xl">{formatBRL(data.monthWithdrawals)}</div>
        </Card>
        <Card>
          <CardLabel>Pontos ativos</CardLabel>
          <div className="num-strong mt-1 text-xl">{data.points.length}</div>
        </Card>
      </section>

      {/* Atenção hoje */}
      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-bold">Atenção hoje</h2>
        {data.attention.length === 0 ? (
          <Card className="text-ink-soft">Tudo em ordem por aqui.</Card>
        ) : (
          data.attention.map((msg) => (
            <Card key={msg} variant="tint" className="flex items-center gap-3">
              <IconWarning size={20} className="shrink-0" />
              <p className="text-[15px]">{msg}</p>
            </Card>
          ))
        )}
      </section>
    </div>
  );
}

/**
 * Barras Produção × Venda do mês (§7.5). Vendido = sand-deep (SPEC §5);
 * produzido = ink-soft. Valores com rótulo direto em cada barra.
 */
function ProductionVsSales({
  produced,
  sold,
  deviationPct,
}: {
  produced: number;
  sold: number;
  deviationPct: number | null;
}) {
  const max = Math.max(produced, sold, 1);
  const alert = deviationPct !== null && Math.abs(deviationPct) > 5;
  return (
    <div className="flex flex-col gap-1.5 border-t border-line pt-3">
      <div className="flex items-center justify-between">
        <CardLabel>Produção × venda (mês)</CardLabel>
        {alert ? <IconWarning size={16} className="text-ink" /> : null}
      </div>
      <BarRow label="Produzido" value={produced} max={max} color="bg-ink-soft" />
      <BarRow label="Vendido" value={sold} max={max} color="bg-sand-deep" />
    </div>
  );
}

function BarRow({
  label,
  value,
  max,
  color,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
}) {
  const pct = Math.max(2, (value / max) * 100);
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="w-20 shrink-0 text-ink-soft">{label}</span>
      <div className="h-4 flex-1 overflow-hidden rounded-[4px]">
        <div
          className={`h-full rounded-[4px] ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="num w-24 shrink-0 text-right">{formatM3(value)}</span>
    </div>
  );
}

function topCategory(byCat: Record<ExpenseCategory, number>): string {
  const entries = Object.entries(byCat) as Array<[ExpenseCategory, number]>;
  entries.sort((a, b) => b[1] - a[1]);
  const top = entries[0];
  if (!top || top[1] === 0) return "sem gastos no mês";
  return `maior: ${EXPENSE_CATEGORY_LABELS[top[0]].toLowerCase()} (${formatBRL(top[1])})`;
}
