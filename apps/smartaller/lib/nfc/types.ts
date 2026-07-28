export type NfcSticker = {
  id: string;
  created_at: string;
  updated_at: string;
  taller_id: string;
  vehiculo_id: string | null;
  token: string;
  etiqueta: string | null;
  placa: string | null;
  marca: string | null;
  modelo: string | null;
  color: string | null;
  nombre_titular: string | null;
  pin_hash: string | null;
  activo: boolean;
  notas: string | null;
  last_verified_at: string | null;
  last_scanned_at: string | null;
};

export type NfcDocumentPublic = {
  id: string;
  docType: string;
  fileName: string;
  filePath: string;
  url: string | null;
};

/** Datos del vehículo desbloqueados tras verificar PIN. */
export type NfcVerifiedVehicle = {
  brand: string | null;
  model: string | null;
  year: number | null;
  plate: string | null;
  vin: string | null;
  entryDate: string | null;
  mileage: number;
  color: string | null;
  nombreTitular: string | null;
  documents: NfcDocumentPublic[];
};

/** Vista pública sin exponer pin_hash ni notas internas. */
export type NfcStickerPublic = {
  token: string;
  etiqueta: string | null;
  placa: string | null;
  marca: string | null;
  modelo: string | null;
  color: string | null;
  nombre_titular: string | null;
  activo: boolean;
  requierePin: boolean;
  tallerNombre: string | null;
  verificado: boolean;
  vehicle: NfcVerifiedVehicle | null;
};

export type NfcStickerListItem = Omit<NfcSticker, "pin_hash"> & {
  tienePin: boolean;
};
