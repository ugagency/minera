"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { createReceipt } from "@/lib/data/admin-actions";
import { centsToDecimalString, decimalStringToCents } from "@/lib/money";
import type { Point } from "@/lib/data/types";
import type { ReceiptMethod } from "@/lib/data/types";

const METHODS: Array<{ value: ReceiptMethod; label: string }> = [
  { value: "cash", label: "Dinheiro" },
  { value: "pix", label: "PIX" },
  { value: "transfer", label: "Transferência" },
];

/** Lançar recebimento — modal de 3 campos (§9.8): valor, forma, ponto. */
export function ReceiptModal({
  clientId,
  points,
  trigger,
}: {
  clientId: string;
  points: Point[];
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(0);
  const [method, setMethod] = useState<ReceiptMethod>("cash");
  const [pointId, setPointId] = useState(points[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    if (amount <= 0) {
      setError("Informe um valor maior que zero.");
      return;
    }
    const fd = new FormData();
    fd.set("client_id", clientId);
    fd.set("point_id", pointId);
    fd.set("amount", String(amount));
    fd.set("method", method);
    startTransition(async () => {
      try {
        await createReceipt(fd);
        setOpen(false);
        setAmount(0);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Não foi possível lançar.");
      }
    });
  }

  return (
    <>
      <span onClick={() => setOpen(true)}>{trigger}</span>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Lançar recebimento"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={submit} disabled={pending}>
              {pending ? "Salvando…" : "Salvar"}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Input
            label="Valor"
            inputMode="decimal"
            value={amount === 0 ? "" : centsToDecimalString(amount)}
            placeholder="0,00"
            onChange={(e) => setAmount(Math.max(0, decimalStringToCents(e.target.value)))}
            error={error ?? undefined}
          />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-ink-soft">Forma</label>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value as ReceiptMethod)}
              className="h-12 rounded-control border border-line bg-card px-4 text-base"
            >
              {METHODS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-ink-soft">Ponto</label>
            <select
              value={pointId}
              onChange={(e) => setPointId(e.target.value)}
              className="h-12 rounded-control border border-line bg-card px-4 text-base"
            >
              {points.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Modal>
    </>
  );
}
