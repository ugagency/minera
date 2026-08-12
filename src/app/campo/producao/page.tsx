import { ProductionExpenseTabs } from "@/components/campo/ProductionExpenseTabs";
import { getActivePoint, getCurrentProfile } from "@/lib/session";
import { listMachines } from "@/lib/data/queries";

export default async function ProducaoPage() {
  const profile = await getCurrentProfile();
  const point = await getActivePoint();
  const machines = await listMachines(profile.company_id, point.id);

  return <ProductionExpenseTabs machines={machines} />;
}
