import Link from "next/link";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/Badge";
import { Card, CardLabel } from "@/components/ui/Card";
import { IconPrint, IconWarning } from "@/components/ui/Icon";
import { CloseSettlementButton } from "@/components/app/CloseSettlementButton";
import { openPeriodCalc, listSettlements } from "@/lib/data/admin-queries";
import { readDb } from "@/lib/data/db";
import { formatBRL } from "@/lib/format";
import { EXPENSE_CATEGORY_LABELS } from "@/lib/labels";
import { cx } from "@/lib/cx";
import type { ExpenseCategory } from "@/lib/data/types";

export const dynamic = "force-dynamic";

export default async function FinanceiroPage({
  searchParams,
}: {
  searchParams: Promise<{ point?: string }>;
}) {
  const { point: pointParam } = await searchParams;
  const db = await readDb();
  const points = db.points;
  const activePoint = points.find((p) => p.id === pointParam) ?? points[0];
  if (!activePoint) {
    return <p className="text-ink-soft">Nenhum ponto cadastrado.</p>;
  }

  const calc = await openPeriodCalc(activePoint.id);
  const settlements = await listSettlements(activePoint.id);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Financeiro</h1>
          <p className="text-ink-soft">Acerto entre sócios e dono do terreno</p>
        </div>
        <div className="flex gap-1">
          {points.map((p) => (
            <Link
              key={p.id}
              href={`/app/financeiro?point=${p.id}`}
              className={cx(
                "rounded-control px-3 py-2 text-[15px] font-medium",
                p.id === activePoint.id
                  ? "bg-ink text-white"
                  : "border border-line bg-card text-ink-soft hover:bg-sand-tint"
              )}
            >
              {p.name}
            </Link>
          ))}
        </div>
      </header>

      {calc.percent_sum !== 0 && calc.percent_sum !== 100 && (
        <Card className="flex items-center gap-2 border-line bg-sand-tint">
          <IconWarning size={18} />
          <p className="text-[15px]">
            Os percentuais dos sócios somam {calc.percent_sum}% (deveriam somar 100%).
            Ajuste em Cadastros.
          </p>
        </Card>
      )}

      <Card variant="ink" className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <CardLabel className="text-white/60">
              Período aberto desde{" "}
              {format(new Date(calc.period_start), "dd/MM/yyyy HH:mm", { locale: ptBR })}
            </CardLabel>
            <div className="num-strong text-3xl">{formatBRL(calc.profit_pool)}</div>
            <div className="text-white/70">lucro a dividir agora</div>
          </div>
          <CloseSettlementButton pointId={activePoint.id} calc={calc} />
        </div>
      </Card>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="flex flex-col gap-2">
          <CardLabel>Entradas</CardLabel>
          <div className="num-strong text-xl">{formatBRL(calc.cash_in)}</div>
          <div className="flex flex-col gap-1 border-t border-line pt-2 text-sm">
            <Row label="À vista + PIX" value={calc.cash_from_sales} />
            <Row label="Fiado recebido" value={calc.cash_from_receipts} />
          </div>
        </Card>

        <Card className="flex flex-col gap-2">
          <CardLabel>Saídas</CardLabel>
          <div className="num-strong text-xl">{formatBRL(calc.expenses_total)}</div>
          <div className="flex flex-col gap-1 border-t border-line pt-2 text-sm">
            {(Object.keys(EXPENSE_CATEGORY_LABELS) as ExpenseCategory[])
              .filter((c) => calc.expenses_by_category[c] > 0)
              .map((c) => (
                <Row key={c} label={EXPENSE_CATEGORY_LABELS[c]} value={calc.expenses_by_category[c]} />
              ))}
            {calc.expenses_total === 0 && <span className="text-ink-faint">Sem gastos</span>}
          </div>
        </Card>

        <Card className="flex flex-col gap-2">
          <CardLabel>Retiradas</CardLabel>
          <div className="num-strong text-xl">
            {formatBRL(calc.lines.filter((l) => l.kind === "partner").reduce((s, l) => s + l.withdrawals_total, 0))}
          </div>
          <div className="flex flex-col gap-1 border-t border-line pt-2 text-sm">
            {calc.lines
              .filter((l) => l.kind === "partner" && l.withdrawals_total > 0)
              .map((l) => (
                <Row key={l.partner_id} label={l.partner_name} value={l.withdrawals_total} />
              ))}
          </div>
        </Card>

        <Card className="flex flex-col gap-2">
          <CardLabel>A receber pendente</CardLabel>
          <div className="num-strong text-xl">{formatBRL(calc.pending_receivable)}</div>
          <p className="border-t border-line pt-2 text-sm text-ink-faint">
            Fiado do período ainda não pago — não entra na divisão.
          </p>
        </Card>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-bold">Divisão prevista</h2>
        <Card padding="none">
          <div className="divide-y divide-line">
            {calc.lines.map((l) => (
              <div key={l.partner_id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <div className="font-medium">{l.partner_name}</div>
                  <div className="text-sm text-ink-faint">
                    {l.kind === "landowner"
                      ? "Dono do terreno"
                      : `Sócio · ${l.percent}% do lucro`}
                  </div>
                </div>
                <div className="text-right">
                  <div className="num-strong text-lg">{formatBRL(l.final_amount)}</div>
                  {l.withdrawals_total > 0 && (
                    <div className="text-sm text-ink-faint">
                      base {formatBRL(l.base_amount)} − {formatBRL(l.withdrawals_total)}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-bold">Histórico de acertos</h2>
        {settlements.length === 0 ? (
          <Card className="text-ink-soft">Nenhum acerto fechado ainda.</Card>
        ) : (
          <Card padding="none">
            <div className="divide-y divide-line">
              {settlements.map((s) => (
                <div key={s.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <div className="font-medium">
                      {format(new Date(s.period_start), "dd/MM/yyyy", { locale: ptBR })} —{" "}
                      {format(new Date(s.period_end), "dd/MM/yyyy", { locale: ptBR })}
                    </div>
                    <div className="text-sm text-ink-faint">
                      Fechado em {format(new Date(s.closed_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <Badge tone={s.profit_pool >= 0 ? "ok" : "danger"}>
                      {formatBRL(s.profit_pool)}
                    </Badge>
                    <Link href={`/print/acerto/${s.id}`} target="_blank">
                      <IconPrint size={18} className="text-ink-soft hover:text-ink" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </section>
    </div>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-ink-soft">{label}</span>
      <span className="num">{formatBRL(value)}</span>
    </div>
  );
}
