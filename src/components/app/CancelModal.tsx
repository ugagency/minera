"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { cancelEntity } from "@/lib/data/admin-actions";

type Kind = "sale" | "expense" | "receipt" | "withdrawal";

/** Modal de cancelamento com motivo obrigatório (§7.3). */
export function CancelModal({
  kind,
  id,
  trigger,
}: {
  kind: Kind;
  id: string;
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function confirm() {
    if (!reason.trim()) {
      setError("Informe o motivo do cancelamento.");
      return;
    }
    startTransition(async () => {
      try {
        await cancelEntity(kind, id, reason);
        setOpen(false);
        setReason("");
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Não foi possível cancelar.");
      }
    });
  }

  return (
    <>
      <span onClick={() => setOpen(true)}>{trigger}</span>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Cancelar lançamento"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Voltar
            </Button>
            <Button variant="primary" onClick={confirm} disabled={pending}>
              {pending ? "Cancelando…" : "Confirmar cancelamento"}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <Input
            label="Motivo"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ex.: lançamento duplicado"
            error={error ?? undefined}
          />
        </div>
      </Modal>
    </>
  );
}
