import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ seed?: string }>;
};

/** Compatibilidad: la carga masiva vive en Nueva importación (?masiva=1). */
export default async function CargaMasivaPuertoLibrePage({ searchParams }: Props) {
  const params = await searchParams;
  const qs = new URLSearchParams({ masiva: "1" });
  if (params.seed === "1") qs.set("seed", "1");
  redirect(`/smartimport/importaciones/nueva?${qs.toString()}`);
}
