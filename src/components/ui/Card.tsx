import type { HTMLAttributes } from "react";
import { cx } from "@/lib/cx";

type CardProps = HTMLAttributes<HTMLDivElement> & {
  /**
   * default: cartão branco sobre fundo areia (sem sombra).
   * ink: cartão preto — reservado a UM destaque por tela.
   * tint: fundo areia suave para destaques leves.
   */
  variant?: "default" | "ink" | "tint";
  padding?: "md" | "lg" | "none";
};

export function Card({
  variant = "default",
  padding = "md",
  className,
  ...props
}: CardProps) {
  return (
    <div
      className={cx(
        "rounded-card border",
        variant === "default" && "border-line bg-card",
        variant === "ink" && "border-ink bg-ink text-white",
        variant === "tint" && "border-line bg-sand-tint",
        padding === "md" && "p-4",
        padding === "lg" && "p-6",
        className
      )}
      {...props}
    />
  );
}

/** Label pequeno acima de valores (caption) */
export function CardLabel({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cx(
        "text-xs font-medium uppercase tracking-wide text-ink-faint",
        className
      )}
      {...props}
    />
  );
}
