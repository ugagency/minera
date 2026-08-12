"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

export type CrudField =
  | { name: string; label: string; type: "text" | "number" | "tel"; required?: boolean; defaultValue?: string }
  | { name: string; label: string; type: "select"; required?: boolean; defaultValue?: string; options: Array<{ value: string; label: string }> }
  | { name: string; label: string; type: "checkbox"; defaultChecked?: boolean };

/** Modal genérico de criar/editar para os CRUDs enxutos de /app/cadastros. */
export function CrudModal({
  title,
  fields,
  action,
  trigger,
  hidden,
}: {
  title: string;
  fields: CrudField[];
  action: (formData: FormData) => Promise<void>;
  trigger: React.ReactNode;
  /** campos extras fixos (ex.: id, point_id, kind) não editáveis pelo usuário */
  hidden?: Record<string, string>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function submit() {
    if (!formRef.current) return;
    const fd = new FormData(formRef.current);
    for (const [k, v] of Object.entries(hidden ?? {})) fd.set(k, v);
    startTransition(async () => {
      try {
        await action(fd);
        setOpen(false);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Não foi possível salvar.");
      }
    });
  }

  return (
    <>
      <span onClick={() => setOpen(true)}>{trigger}</span>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={title}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={submit} disabled={pending}>
              {pending ? "Salvando…" : "Salvar"}
            </Button>
          </>
        }
      >
        <form ref={formRef} className="flex flex-col gap-4">
          {fields.map((f) => (
            <FieldInput key={f.name} field={f} />
          ))}
          {error && <p className="text-sm text-danger">{error}</p>}
        </form>
      </Modal>
    </>
  );
}

function FieldInput({ field }: { field: CrudField }) {
  if (field.type === "select") {
    return (
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-ink-soft">{field.label}</label>
        <select name={field.name} defaultValue={field.defaultValue} required={field.required} className="fld">
          {field.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
    );
  }
  if (field.type === "checkbox") {
    return (
      <label className="flex items-center gap-2 text-sm font-medium text-ink-soft">
        <input type="checkbox" name={field.name} defaultChecked={field.defaultChecked} className="h-4 w-4" />
        {field.label}
      </label>
    );
  }
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-ink-soft">{field.label}</label>
      <input
        type={field.type}
        name={field.name}
        defaultValue={field.defaultValue}
        required={field.required}
        className="fld"
      />
    </div>
  );
}
