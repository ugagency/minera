"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { signIn } from "@/lib/auth-actions";

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await signIn(formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      // navegação completa (não router.push): o middleware decide o
      // destino por role, e um redirect de servidor sempre é seguido —
      // uma navegação soft do router às vezes não acompanha o redirect.
      window.location.assign("/");
    });
  }

  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-extrabold">MineraPonto</h1>
          <p className="mt-1 text-ink-soft">Entrar na sua conta</p>
        </div>
        <form action={handleSubmit} className="flex flex-col gap-4">
          <Input label="E-mail" name="email" type="email" required autoFocus />
          <Input label="Senha" name="password" type="password" required />
          {error && <p className="text-sm text-danger">{error}</p>}
          <Button type="submit" variant="primary" size="lg" fullWidth disabled={pending}>
            {pending ? "Entrando…" : "Entrar"}
          </Button>
        </form>
      </Card>
    </main>
  );
}
