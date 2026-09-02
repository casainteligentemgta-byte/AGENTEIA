import { SmartImportDemoCliente } from "@/components/nfc/SmartImportDemoCliente";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Demo a cliente — SmartImport",
  description:
    "Guion de 60 minutos y cuestionario para afinar el piloto de SmartImport.",
};

export default function SmartImportDemoPage() {
  return <SmartImportDemoCliente />;
}
