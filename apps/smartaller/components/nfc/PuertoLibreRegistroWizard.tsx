"use client";

import type { ImportadorListItem } from "@/app/actions/nfc/importadores";
import { RegistrarImportacionWizard } from "@/components/nfc/RegistrarImportacionWizard";

type Props = {
  initialImportadores?: ImportadorListItem[];
};

/** Wizard de alta: cliente importador → datos de la importación. */
export function PuertoLibreRegistroWizard({
  initialImportadores = [],
}: Props) {
  return <RegistrarImportacionWizard initialImportadores={initialImportadores} />;
}
