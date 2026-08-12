"use client";

import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { CancelModal } from "@/components/app/CancelModal";
import { PAYMENT_METHOD_LABELS } from "@/lib/labels";
import { formatBRL, formatM3 } from "@/lib/format";
import type { SaleRow } from "@/lib/data/admin-queries";

export function SaleDetailModal({ sale }: { sale: SaleRow }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-left font-medium text-ink underline decoration-line underline-offset-2 hover:decoration-ink"
      >
        {sale.receipt_no}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={`Venda ${sale.receipt_no}`}>
        <div className="flex flex-col gap-4">
          {sale.status === "canceled" && (
            <Badge tone="danger">Cancelada — {sale.cancel_reason}</Badge>
          )}
          <Row label="Data" value={format(new Date(sale.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })} />
          <Row label="Ponto" value={sale.pointName} />
          <Row label="Cliente" value={sale.clientName} />
          <Row label="Produto" value={sale.productName} />
          <Row label="Quantidade" value={formatM3(sale.qty_m3)} />
          <Row label="Total" value={formatBRL(sale.total)} strong />
          <div className="flex flex-col gap-1">
            {sale.payments.map((p) => (
              <Row key={p.id} label={PAYMENT_METHOD_LABELS[p.method]} value={formatBRL(p.amount)} />
            ))}
          </div>

          {sale.photoSignedUrl ? (
            <div className="overflow-hidden rounded-card border border-line">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={sale.photoSignedUrl} alt="Foto de retirada" className="w-full object-cover" />
            </div>
          ) : (
            <p className="text-sm text-ink-faint">Sem foto registrada.</p>
          )}
          {sale.gps_lat !== null && sale.gps_lng !== null ? (
            <p className="text-sm text-ink-faint">
              GPS: {sale.gps_lat.toFixed(6)}, {sale.gps_lng.toFixed(6)}
            </p>
          ) : null}

          {sale.canCancel && (
            <CancelModal
              kind="sale"
              id={sale.id}
              trigger={
                <Button variant="ghost" className="w-full">
                  Cancelar venda
                </Button>
              }
            />
          )}
        </div>
      </Modal>
    </>
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
