import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card, CardLabel } from "@/components/ui/Card";
import { IconCamera, IconCoins } from "@/components/ui/Icon";
import { PointSwitcher } from "@/components/campo/PointSwitcher";
import { LogoutButton } from "@/components/app/LogoutButton";
import { getActivePoint, getCurrentProfile } from "@/lib/session";
import { listPoints, todaySummary } from "@/lib/data/queries";
import { formatBRL, formatM3 } from "@/lib/format";

export default async function CampoPage() {
  const profile = await getCurrentProfile();
  const point = await getActivePoint();
  const points = await listPoints(profile.company_id);
  const summary = await todaySummary(point.id);

  return (
    <main className="mx-auto flex min-h-dvh max-w-[420px] flex-col gap-6 px-4 py-6">
      <header className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-ink-faint">
            {profile.name}
          </span>
          <div className="flex items-center gap-2">
            <PointSwitcher points={points} activePointId={point.id} />
            <LogoutButton />
          </div>
        </div>
        <Card variant="ink" className="flex flex-col gap-1">
          <CardLabel className="text-white/60">{point.name}</CardLabel>
          <div className="num-strong text-3xl">
            {formatBRL(summary.totalCents)}
          </div>
          <div className="text-white/70">
            hoje · {formatM3(summary.m3)}
          </div>
        </Card>
      </header>

      <nav className="flex flex-col gap-3">
        <Link href="/campo/venda">
          <Button variant="primary" size="lg" fullWidth>
            <IconCoins size={22} /> Venda
          </Button>
        </Link>
        <Link href="/campo/producao">
          <Button variant="ghost" size="lg" fullWidth>
            <IconCamera size={22} /> Produção / Gasto
          </Button>
        </Link>
      </nav>
    </main>
  );
}
