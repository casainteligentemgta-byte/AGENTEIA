export const BIBLIOTECA_LEGAL_CATEGORIAS = [
  "decreto",
  "ley",
  "reglamento",
  "resolucion",
  "anexo",
  "arancel",
  "gaceta",
  "otro",
] as const;

export type BibliotecaLegalCategoria =
  (typeof BIBLIOTECA_LEGAL_CATEGORIAS)[number];

export const BIBLIOTECA_LEGAL_CATEGORIA_LABELS: Record<
  BibliotecaLegalCategoria,
  string
> = {
  decreto: "Decreto",
  ley: "Ley",
  reglamento: "Reglamento",
  resolucion: "Resolución",
  anexo: "Anexo",
  arancel: "Arancel / tarifas",
  gaceta: "Gaceta Oficial",
  otro: "Otro",
};

export type BibliotecaLegalDocumento = {
  id: string;
  categoria: BibliotecaLegalCategoria;
  titulo: string;
  descripcion: string | null;
  organismo: string | null;
  anio: number | null;
  normaId: string | null;
  fileName: string;
  filePath: string;
  fileUrl: string;
  fileSize: number | null;
  createdAt: string;
};

export function isBibliotecaLegalCategoria(
  value: string
): value is BibliotecaLegalCategoria {
  return (BIBLIOTECA_LEGAL_CATEGORIAS as readonly string[]).includes(value);
}

export function formatFileSize(bytes: number | null): string {
  if (bytes == null || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
