import { CuestionarioValidacionView } from "@/components/nfc/CuestionarioValidacionView";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Validación con el cliente — SmartImport",
  description:
    "Cuestionario profesional para validar datos y documentos del flujo Puerto Libre con el cliente.",
};

export default function SmartImportValidacionPage() {
  return <CuestionarioValidacionView />;
}
