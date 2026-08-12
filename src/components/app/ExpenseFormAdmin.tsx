"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { Input } from "@/components/ui/Input";
import { createExpenseAdmin } from "@/lib/data/admin-actions";
import { EXPENSE_CATEGORY_LABELS } from "@/lib/labels";
import { centsToDecimalString, decimalStringToCents } from "@/lib/money";
import type { ExpenseCategory, Machine, Point } from "@/lib/data/types";

export function ExpenseFormAdmin({
  points,
  machines,
}: {
  points: Point[];
  machines: Machine[];
}) {
  const router = useRouter();
  const [pointId, setPointId] = useState(points[0]?.id ?? "");
  const [category, setCategory] = useState<ExpenseCategory | null>(null);
  const [amount, setAmount] = useState(0);
  const [liters, setLiters] = useState("");
  const [machineId, setMachineId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  const pointMachines = useMemo(
    () => machines.filter((m) => m.point_id === pointId),
    [machines, pointId]
  );
  const canSave = category !== null && amount > 0 && pointId;

  function save() {
    if (!category) return;
    const fd = new FormData();
    fd.set("point_id", pointId);
    fd.set("category", category);
    fd.set("amount", String(amount));
    if (category === "diesel" && liters) fd.set("liters", liters);
    if (machineId) fd.set("machine_id", machineId);
    startTransition(async () => {
      await createExpenseAdmin(fd);
      setSaved(true);
      setCategory(null);
      setAmount(0);
      setLiters("");
      setMachineId(null);
      router.refresh();
      setTimeout(() => setSaved(false), 2500);
    });
  }

  return (
    <Card className="flex flex-col gap-4">
      <h2 className="font-bold">Lançamento rápido</h2>
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-ink-soft">Ponto</label>
        <select
          value={pointId}
          onChange={(e) => {
            setPointId(e.target.value);
            setMachineId(null);
          }}
          className="fld"
        >
          {points.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap gap-2">
        {(Object.keys(EXPENSE_CATEGORY_LABELS) as ExpenseCategory[]).map((c) => (
          <Chip key={c} selected={category === c} onClick={() => setCategory(c)}>
            {EXPENSE_CATEGORY_LABELS[c]}
          </Chip>
        ))}
      </div>

      <Input
        label="Valor"
        inputMode="decimal"
        value={amount === 0 ? "" : centsToDecimalString(amount)}
        placeholder="0,00"
        onChange={(e) => setAmount(Math.max(0, decimalStringToCents(e.target.value)))}
      />

      {category === "diesel" && (
        <Input
          label="Litros"
          inputMode="decimal"
          value={liters}
          placeholder="0,0"
          onChange={(e) => setLiters(e.target.value)}
        />
      )}

      {pointMachines.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-ink-soft">Máquina (opcional)</label>
          <div className="flex flex-wrap gap-2">
            <Chip selected={machineId === null} onClick={() => setMachineId(null)}>
              Sem máquina
            </Chip>
            {pointMachines.map((m) => (
              <Chip key={m.id} selected={machineId === m.id} onClick={() => setMachineId(m.id)}>
                {m.name}
              </Chip>
            ))}
          </div>
        </div>
      )}

      {saved && <p className="text-sm font-medium text-ok">Gasto salvo!</p>}

      <Button variant="primary" disabled={!canSave || pending} onClick={save}>
        {pending ? "Salvando…" : "Salvar gasto"}
      </Button>
    </Card>
  );
}
