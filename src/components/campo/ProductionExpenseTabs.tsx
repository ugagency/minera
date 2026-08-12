"use client";

import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { IconCamera, IconCheck } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Input";
import { Stepper } from "@/components/ui/Stepper";
import { createExpense, createProductionLog } from "@/lib/data/actions";
import type { ExpenseCategory, Machine } from "@/lib/data/types";
import { formatBRL } from "@/lib/format";
import { centsToDecimalString, decimalStringToCents } from "@/lib/money";

type Props = { machines: Machine[] };

const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  diesel: "Diesel",
  part_service: "Peça/Serviço",
  labor: "Mão de obra",
  freight: "Frete",
  other: "Outro",
};

export function ProductionExpenseTabs({ machines }: Props) {
  const [tab, setTab] = useState<"producao" | "gasto">("producao");

  return (
    <div className="mx-auto flex min-h-dvh max-w-[420px] flex-col gap-5 px-4 py-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-bold">Produção / Gasto</h1>
      </header>

      <div className="flex gap-2 border-b border-line">
        <TabButton active={tab === "producao"} onClick={() => setTab("producao")}>
          Produção
        </TabButton>
        <TabButton active={tab === "gasto"} onClick={() => setTab("gasto")}>
          Gasto
        </TabButton>
      </div>

      {tab === "producao" ? (
        <ProducaoForm machines={machines} />
      ) : (
        <GastoForm machines={machines} />
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "border-b-2 px-3 py-2.5 text-[15px] font-semibold transition-colors " +
        (active
          ? "border-ink text-ink"
          : "border-transparent text-ink-faint hover:text-ink-soft")
      }
    >
      {children}
    </button>
  );
}

function ProducaoForm({ machines }: { machines: Machine[] }) {
  const [machineId, setMachineId] = useState<string | null>(null);
  const [mode, setMode] = useState<"trips" | "m3">("m3");
  const [trips, setTrips] = useState(1);
  const [m3PerTrip, setM3PerTrip] = useState(6);
  const [m3Direct, setM3Direct] = useState(1);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  const m3 = mode === "trips" ? round2(trips * m3PerTrip) : m3Direct;

  function save() {
    const fd = new FormData();
    if (machineId) fd.set("machine_id", machineId);
    if (mode === "trips") fd.set("trips", String(trips));
    fd.set("m3", String(m3));

    startTransition(async () => {
      await createProductionLog(fd);
      setSaved(true);
      setTrips(1);
      setM3Direct(1);
      setMachineId(null);
      setTimeout(() => setSaved(false), 2500);
    });
  }

  return (
    <section className="flex flex-col gap-4">
      <MachineChips machines={machines} value={machineId} onChange={setMachineId} optional />

      <div className="flex gap-2">
        <Chip selected={mode === "m3"} onClick={() => setMode("m3")}>
          m³ direto
        </Chip>
        <Chip selected={mode === "trips"} onClick={() => setMode("trips")}>
          Por viagens
        </Chip>
      </div>

      {mode === "m3" ? (
        <Stepper label="Quantidade" value={m3Direct} onChange={setM3Direct} min={0.5} step={0.5} suffix="m³" />
      ) : (
        <div className="flex flex-col gap-4">
          <Stepper label="Nº de viagens" value={trips} onChange={setTrips} min={1} step={1} suffix="viagens" />
          <Stepper label="m³ por viagem" value={m3PerTrip} onChange={setM3PerTrip} min={0.5} step={0.5} suffix="m³" />
          <Card variant="tint" className="flex items-baseline justify-between">
            <span className="text-ink-soft">Total produzido</span>
            <span className="num-strong text-lg">{m3} m³</span>
          </Card>
        </div>
      )}

      {saved && <SavedBanner />}

      <Button variant="primary" size="lg" fullWidth disabled={pending} onClick={save}>
        {pending ? "Salvando…" : "Salvar produção"}
      </Button>
    </section>
  );
}

function GastoForm({ machines }: { machines: Machine[] }) {
  const [category, setCategory] = useState<ExpenseCategory | null>(null);
  const [amount, setAmount] = useState(0); // centavos
  const [liters, setLiters] = useState("");
  const [machineId, setMachineId] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  const canSave = category !== null && amount > 0;

  function save() {
    if (!category) return;
    const fd = new FormData();
    fd.set("category", category);
    fd.set("amount", String(amount));
    if (category === "diesel" && liters) fd.set("liters", liters);
    if (machineId) fd.set("machine_id", machineId);
    if (photoFile) fd.set("photo", photoFile);

    startTransition(async () => {
      await createExpense(fd);
      setSaved(true);
      setCategory(null);
      setAmount(0);
      setLiters("");
      setMachineId(null);
      setPhotoFile(null);
      setTimeout(() => setSaved(false), 2500);
    });
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {(Object.keys(CATEGORY_LABELS) as ExpenseCategory[]).map((c) => (
          <Chip key={c} selected={category === c} onClick={() => setCategory(c)}>
            {CATEGORY_LABELS[c]}
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

      <MachineChips machines={machines} value={machineId} onChange={setMachineId} optional />

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
      />
      <Button variant="ghost" onClick={() => inputRef.current?.click()}>
        <IconCamera size={18} /> {photoFile ? "Foto anexada" : "Foto (opcional)"}
      </Button>

      {amount > 0 && (
        <Card variant="tint" className="flex items-baseline justify-between">
          <span className="text-ink-soft">Valor do gasto</span>
          <span className="num-strong text-lg">{formatBRL(amount)}</span>
        </Card>
      )}

      {saved && <SavedBanner />}

      <Button variant="primary" size="lg" fullWidth disabled={!canSave || pending} onClick={save}>
        {pending ? "Salvando…" : "Salvar gasto"}
      </Button>
    </section>
  );
}

function MachineChips({
  machines,
  value,
  onChange,
  optional,
}: {
  machines: Machine[];
  value: string | null;
  onChange: (id: string | null) => void;
  optional?: boolean;
}) {
  if (machines.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {optional && (
        <Chip selected={value === null} onClick={() => onChange(null)}>
          Sem máquina
        </Chip>
      )}
      {machines.map((m) => (
        <Chip key={m.id} selected={value === m.id} onClick={() => onChange(m.id)}>
          {m.name}
        </Chip>
      ))}
    </div>
  );
}

function SavedBanner() {
  return (
    <Card className="flex items-center gap-2 border-ok bg-ok-tint">
      <IconCheck size={18} className="text-ok" />
      <span className="text-[15px] text-ok">Salvo!</span>
    </Card>
  );
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
