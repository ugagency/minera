"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card, CardLabel } from "@/components/ui/Card";
import { IconWarning } from "@/components/ui/Icon";
import { Modal } from "@/components/ui/Modal";
import { closeSettlement } from "@/lib/data/admin-actions";
import { formatBRL } from "@/lib/format";
import type { SettlementCalc } from "@/lib/data/settlement";

export function CloseSettlementButton({
  pointId,
  calc,
}: {
  pointId: string;
  calc: SettlementCalc;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [closedId, setClosedId] = useState<string | null>(null);

  function confirm() {
    setError(null);
    startTransition(async () => {
      try {
        const id = await closeSettlement(pointId);
        setClosedId(id);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Não foi possível fechar o acerto.");
      }
    });
  }

  return (
    <>
      <Button variant="ink" size="lg" onClick={() => setOpen(true)}>
        Fechar acerto
      </Button>
      <Modal
        open={open}
        onClose={() => {
          setOpen(false);
          setClosedId(null);
        }}
        title={closedId ? "Acerto fechado" : "Confirmar acerto"}
        footer={
          closedId ? (
            <>
              <Link href={`/print/acerto/${closedId}`} target="_blank">
                <Button variant="ghost">Imprimir/PDF</Button>
              </Link>
              <Button variant="primary" onClick={() => setOpen(false)}>
                Concluir
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Voltar
              </Button>
              <Button variant="primary" onClick={confirm} disabled={pending}>
                {pending ? "Fechando…" : "Confirmar e fechar"}
              </Button>
            </>
          )
        }
      >
        {closedId ? (
          <p className="text-[15px]">
            Acerto fechado e registrado. A divisão abaixo é definitiva — o histórico já
            foi atualizado.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            <Card variant="tint" className="flex items-baseline justify-between">
              <CardLabel>Lucro a dividir</CardLabel>
              <span className="num-strong text-xl">{formatBRL(calc.profit_pool)}</span>
            </Card>
            <div className="flex flex-col gap-2">
              {calc.lines.map((l) => (
                <div key={l.partner_id} className="flex items-baseline justify-between">
                  <span className="text-ink-soft">
                    {l.partner_name}
                    {l.kind === "landowner" ? " (terreno)" : l.percent !== null ? ` (${l.percent}%)` : ""}
                  </span>
                  <span className="num text-[15px]">{formatBRL(l.final_amount)}</span>
                </div>
              ))}
            </div>
            {calc.pending_receivable > 0 && (
              <Card className="flex items-center gap-2 border-line bg-sand-tint">
                <IconWarning size={18} />
                <p className="text-sm">
                  {formatBRL(calc.pending_receivable)} em fiado do período seguem em aberto
                  — não somem, ficam em Contas a receber.
                </p>
              </Card>
            )}
            {error && <p className="text-sm text-danger">{error}</p>}
            <p className="text-sm text-ink-faint">
              Depois de confirmado, o acerto fica registrado e não pode mais ser
              alterado.
            </p>
          </div>
        )}
      </Modal>
    </>
  );
}
