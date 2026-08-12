"use client";

import { useTransition } from "react";
import { signOut } from "@/lib/auth-actions";

export function LogoutButton() {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await signOut();
          window.location.assign("/login");
        })
      }
      className="text-sm font-medium text-ink-faint hover:text-ink"
    >
      Sair
    </button>
  );
}
