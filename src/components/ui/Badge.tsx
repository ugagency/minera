import type { HTMLAttributes } from "react";
import { cx } from "@/lib/cx";

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  /** ok: pago/positivo · danger: vencido/negativo · attention: aviso âmbar · neutral: informativo */
  tone?: "ok" | "danger" | "attention" | "neutral";
};

export function Badge({ tone = "neutral", className, ...props }: BadgeProps) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[13px] font-semibold",
        tone === "ok" && "bg-ok-tint text-ok",
        tone === "danger" && "bg-danger-tint text-danger",
        tone === "attention" && "bg-sand-tint text-ink",
        tone === "neutral" && "border border-line bg-card text-ink-soft",
        className
      )}
      {...props}
    />
  );
}
