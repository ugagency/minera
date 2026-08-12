"use client";

import type { ButtonHTMLAttributes } from "react";
import { cx } from "@/lib/cx";

type ChipProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  selected?: boolean;
};

/** Chip selecionável (pill). Usado para veículos, categorias, máquinas. */
export function Chip({ selected, className, ...props }: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cx(
        "inline-flex min-h-[44px] items-center gap-1.5 rounded-full border px-4 text-[15px] font-medium transition-colors",
        selected
          ? "border-ink bg-ink text-white"
          : "border-line bg-card text-ink hover:bg-sand-tint",
        className
      )}
      {...props}
    />
  );
}
