import { getCentrosServicio } from "@/lib/data/service-centers";
import { ServiceCentersView } from "@/components/app/service-centers/service-centers-view";

export const dynamic = "force-dynamic";

export default async function CentrosPage() {
  const centros = await getCentrosServicio();

  return <ServiceCentersView centros={centros} />;
}
