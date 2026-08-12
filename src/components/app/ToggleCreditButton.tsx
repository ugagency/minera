"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { toggleClientCredit } from "@/lib/data/admin-actions";

export function ToggleCreditButton({
  clientId,
  enabled,
}: {
  clientId: string;
  enabled: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="ghost"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await toggleClientCredit(clientId);
          router.refresh();
        })
      }
    >
      {enabled ? "Bloquear a prazo" : "Liberar a prazo"}
    </Button>
  );
}
