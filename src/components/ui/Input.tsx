import { forwardRef, useId, type InputHTMLAttributes } from "react";
import { cx } from "@/lib/cx";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
  error?: string;
};

// Fonte ≥ 16px para evitar zoom no mobile; label sempre presente (a11y).
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, className, id, ...props },
  ref
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <div className={cx("flex flex-col gap-1.5", className)}>
      <label htmlFor={inputId} className="text-sm font-medium text-ink-soft">
        {label}
      </label>
      <input
        ref={ref}
        id={inputId}
        className={cx(
          "h-12 rounded-control border bg-card px-4 text-base text-ink placeholder:text-ink-faint",
          error ? "border-danger" : "border-line"
        )}
        aria-invalid={error ? true : undefined}
        {...props}
      />
      {error ? (
        <p className="text-sm text-danger">{error}</p>
      ) : hint ? (
        <p className="text-sm text-ink-faint">{hint}</p>
      ) : null}
    </div>
  );
});
