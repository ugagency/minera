import { SaleWizard } from "@/components/campo/SaleWizard";
import { getActivePoint, getCurrentProfile } from "@/lib/session";
import { listClients, listProducts, listVehicles } from "@/lib/data/queries";

export default async function VendaPage() {
  const profile = await getCurrentProfile();
  const point = await getActivePoint();

  const [clients, products, vehicles] = await Promise.all([
    listClients(profile.company_id),
    listProducts(profile.company_id, point.id),
    listVehicles(profile.company_id),
  ]);

  return (
    <SaleWizard point={point} clients={clients} products={products} vehicles={vehicles} />
  );
}
