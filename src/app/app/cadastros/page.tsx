import { CadastrosTabs } from "@/components/app/cadastros/CadastrosTabs";
import { readDb } from "@/lib/data/db";

export const dynamic = "force-dynamic";

export default async function CadastrosPage() {
  const db = readDb();

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold">Cadastros</h1>
        <p className="text-ink-soft">Pontos, sócios, produtos, clientes, veículos e máquinas</p>
      </header>

      <CadastrosTabs
        points={db.points}
        counters={db.point_counters}
        partners={db.partners}
        products={db.products}
        vehicles={db.vehicles}
        machines={db.machines}
        clients={db.clients}
        profiles={db.profiles}
      />
    </div>
  );
}
