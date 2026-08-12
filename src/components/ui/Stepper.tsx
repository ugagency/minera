"use client";

import { cx } from "@/lib/cx";

type StepperProps = {
  value: number;
  onChange: (value: number) => void;
  step?: number;
  min?: number;
  max?: number;
  /** Sufixo exibido junto ao valor (ex.: "m³", "viagens") */
  suffix?: string;
  label?: string;
  className?: string;
};

const fmt = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });

/** Stepper com alvos de toque ≥ 56px (rotas /campo). */
export function Stepper({
  value,
  onChange,
  step = 0.5,
  min = 0,
  max,
  suffix,
  label,
  className,
}: StepperProps) {
  const dec = () => onChange(Math.max(min, round2(value - step)));
  const inc = () =>
    onChange(max !== undefined ? Math.min(max, round2(value + step)) : round2(value + step));

  return (
    <div className={cx("flex flex-col gap-1.5", className)}>
      {label ? (
        <span className="text-sm font-medium text-ink-soft">{label}</span>
      ) : null}
      <div className="flex items-stretch gap-2">
        <button
          type="button"
          onClick={dec}
          disabled={value <= min}
          aria-label="Diminuir"
          className="flex h-14 w-14 items-center justify-center rounded-control border border-line bg-card text-2xl font-semibold text-ink transition-colors hover:bg-sand-tint disabled:opacity-40"
        >
          −
        </button>
        <div className="flex h-14 min-w-[7rem] flex-1 items-center justify-center rounded-control border border-line bg-card">
          <span className="num-strong text-xl">
            {fmt.format(value)}
            {suffix ? (
              <span className="ml-1 text-base font-medium text-ink-soft">
                {suffix}
              </span>
            ) : null}
          </span>
        </div>
        <button
          type="button"
          onClick={inc}
          aria-label="Aumentar"
          className="flex h-14 w-14 items-center justify-center rounded-control bg-sand text-2xl font-semibold text-ink transition-colors hover:bg-sand-deep"
        >
          +
        </button>
      </div>
    </div>
  );
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
