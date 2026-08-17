"use client";

import type { ImportadorListItem } from "@/app/actions/nfc/importadores";
import { RegistrarImportacionWizard } from "@/components/nfc/RegistrarImportacionWizard";

type Props = {
  initialImportadores?: ImportadorListItem[];
  tallerId: string;
};

/** Wizard de alta: cliente importador → datos de la importación. */
export function PuertoLibreRegistroWizard({
  initialImportadores = [],
  tallerId,
}: Props) {
  return (
    <RegistrarImportacionWizard
      initialImportadores={initialImportadores}
      tallerId={tallerId}
    />
  );
}
