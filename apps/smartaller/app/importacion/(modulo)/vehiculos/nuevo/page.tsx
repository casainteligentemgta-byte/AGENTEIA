import { redirect } from "next/navigation";

/** Compat: el alta pasó a «Registrar importación» (cliente primero). */
export default function NuevoVehiculoPuertoLibreRedirectPage() {
  redirect("/importacion/importaciones/nueva");
}
