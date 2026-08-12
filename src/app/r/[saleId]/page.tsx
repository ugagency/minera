import { notFound } from "next/navigation";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardLabel } from "@/components/ui/Card";
import { getSaleDetails } from "@/lib/data/queries";
import { formatBRL, formatM3 } from "@/lib/format";
import { DEMO_PIX_KEY, RECEIPT_FOOTER } from "@/lib/config";

const METHOD_LABELS: Record<string, string> = {
  cash: "Dinheiro",
  pix: "PIX",
  credit: "Fiado",
};

// Página pública do recibo (sem login) — é o link enviado no WhatsApp.
export default async function ReceiptPage({
  params,
}: {
  params: Promise<{ saleId: string }>;
}) {
  const { saleId } = await params;
  const details = await getSaleDetails(saleId);
  if (!details) notFound();

  const { sale, point, product, client, payments, photoSignedUrl } = details;
  const createdAt = new Date(sale.created_at);
  const hasPix = payments.some((p) => p.method === "pix");

  return (
    <main className="mx-auto flex min-h-dvh max-w-[420px] flex-col gap-5 px-4 py-8">
      <header className="flex flex-col items-center gap-1 text-center">
        <span className="text-sm font-medium text-ink-faint">MineraPonto</span>
        <h1 className="text-xl font-bold">Recibo {sale.receipt_no}</h1>
        <span className="text-sm text-ink-soft">
          {format(createdAt, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
        </span>
        {sale.status === "canceled" && (
          <span className="mt-1 rounded-full bg-danger-tint px-3 py-1 text-sm font-semibold text-danger">
            Venda cancelada
          </span>
        )}
      </header>

      <Card className="flex flex-col gap-2">
        <Row label="Ponto" value={point.name} />
        <Row label="Cliente" value={client?.name ?? "Venda avulsa"} />
        <Row label="Produto" value={product.name} />
        <Row label="Quantidade" value={formatM3(sale.qty_m3)} />
        <div className="border-t border-line pt-2">
          <Row label="Total" value={formatBRL(sale.total)} strong />
        </div>
      </Card>

      <Card className="flex flex-col gap-2">
        <CardLabel>Forma(s) de pagamento</CardLabel>
        {payments.map((p) => (
          <Row key={p.id} label={METHOD_LABELS[p.method] ?? p.method} value={formatBRL(p.amount)} />
        ))}
      </Card>

      {hasPix && (
        <Card className="flex flex-col gap-1">
          <CardLabel>Chave PIX</CardLabel>
          <span className="num text-[15px]">{DEMO_PIX_KEY}</span>
        </Card>
      )}

      {photoSignedUrl && (
        <Card className="flex flex-col gap-2" padding="none">
          <div className="overflow-hidden rounded-card">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photoSignedUrl} alt="Foto de retirada" className="w-full object-cover" />
          </div>
          <div className="flex flex-col gap-1 p-4 pt-0 text-sm text-ink-faint">
            <span>{format(createdAt, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
            {sale.gps_lat !== null && sale.gps_lng !== null ? (
              <span>
                GPS: {sale.gps_lat.toFixed(6)}, {sale.gps_lng.toFixed(6)}
              </span>
            ) : (
              <span>GPS indisponível no momento do registro</span>
            )}
          </div>
        </Card>
      )}

      <p className="pb-4 pt-2 text-center text-xs text-ink-faint">{RECEIPT_FOOTER}</p>
    </main>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-ink-soft">{label}</span>
      <span className={strong ? "num-strong text-lg" : "num text-[15px]"}>{value}</span>
    </div>
  );
}
