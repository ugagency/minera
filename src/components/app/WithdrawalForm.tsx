"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { createWithdrawal } from "@/lib/data/admin-actions";
import { centsToDecimalString, decimalStringToCents } from "@/lib/money";
import type { Partner } from "@/lib/data/types";

export function WithdrawalForm({ partners }: { partners: Partner[] }) {
  const router = useRouter();
  const [partnerId, setPartnerId] = useState(partners[0]?.id ?? "");
  const [amount, setAmount] = useState(0);
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function save() {
    if (!partnerId || amount <= 0) return;
    const fd = new FormData();
    fd.set("partner_id", partnerId);
    fd.set("amount", String(amount));
    if (note) fd.set("note", note);
    startTransition(async () => {
      await createWithdrawal(fd);
      setSaved(true);
      setAmount(0);
      setNote("");
      router.refresh();
      setTimeout(() => setSaved(false), 2500);
    });
  }

  return (
    <Card className="flex flex-col gap-4">
      <h2 className="font-bold">Lançar retirada</h2>
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-ink-soft">Sócio</label>
        <select value={partnerId} onChange={(e) => setPartnerId(e.target.value)} className="fld">
          {partners.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
      <Input
        label="Valor"
        inputMode="decimal"
        value={amount === 0 ? "" : centsToDecimalString(amount)}
        placeholder="0,00"
        onChange={(e) => setAmount(Math.max(0, decimalStringToCents(e.target.value)))}
      />
      <Input
        label="Observação"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Opcional"
      />
      {saved && <p className="text-sm font-medium text-ok">Retirada lançada!</p>}
      <Button variant="primary" disabled={!partnerId || amount <= 0 || pending} onClick={save}>
        {pending ? "Salvando…" : "Salvar retirada"}
      </Button>
    </Card>
  );
}
