"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setActivePoint } from "@/lib/data/actions";
import type { Point } from "@/lib/data/types";

// Plumbing temporário: sem auth ainda, o operador de campo escolhe o ponto
// manualmente. Some quando profiles ganharem vínculo de ponto (F1).
export function PointSwitcher({
  points,
  activePointId,
}: {
  points: Point[];
  activePointId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (points.length <= 1) return null;

  return (
    <select
      value={activePointId}
      disabled={pending}
      onChange={(e) => {
        const id = e.target.value;
        startTransition(async () => {
          await setActivePoint(id);
          router.refresh();
        });
      }}
      className="h-9 rounded-control border border-line bg-card px-3 text-sm text-ink-soft"
      aria-label="Trocar ponto ativo"
    >
      {points.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
    </select>
  );
}
