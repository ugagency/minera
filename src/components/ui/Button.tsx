import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cx } from "@/lib/cx";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  /**
   * primary: ação principal (areia, texto preto).
   * ink: cartão preto — reservado a UM destaque por tela.
   * ghost: ação secundária (branco com borda).
   */
  variant?: "primary" | "ink" | "ghost";
  /** lg atinge alvo de toque ≥ 56px (rotas /campo) */
  size?: "md" | "lg";
  fullWidth?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    { variant = "primary", size = "md", fullWidth, className, ...props },
    ref
  ) {
    return (
      <button
        ref={ref}
        className={cx(
          "inline-flex items-center justify-center gap-2 rounded-control font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50",
          size === "md" && "h-11 px-5 text-[15px]",
          size === "lg" && "min-h-[56px] px-6 text-base",
          variant === "primary" &&
            "bg-sand text-ink hover:bg-sand-deep active:bg-sand-deep",
          variant === "ink" && "bg-ink text-white hover:bg-black",
          variant === "ghost" &&
            "border border-line bg-card text-ink hover:bg-sand-tint",
          fullWidth && "w-full",
          className
        )}
        {...props}
      />
    );
  }
);
