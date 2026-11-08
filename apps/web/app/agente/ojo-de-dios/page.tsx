import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { OjoDeDiosDashboard } from "@/components/ojo-de-dios/dashboard";
import { authorizeOjoDeDios, getOjoDeDiosSessionUser } from "@/lib/ojo-de-dios/auth";
import { getOjoDeDiosSnapshot } from "@/lib/ojo-de-dios/service";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export const metadata: Metadata = {
  title: "Ojo de Dios",
  robots: { index: false, follow: false, nocache: true },
};

export default async function OjoDeDiosPage() {
  const access = await authorizeOjoDeDios();
  if (!access.ok) {
    if (access.status === 404) notFound();
    redirect("/login?redirectTo=/agente/ojo-de-dios");
  }

  const user = await getOjoDeDiosSessionUser();
  const snapshot = await getOjoDeDiosSnapshot(user);
  return <OjoDeDiosDashboard initial={snapshot} />;
}
