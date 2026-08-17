import { redirect } from "next/navigation";
import { IMPORTACION_BASE } from "@/lib/importacion/paths";

export default function LoginRedirectPage() {
  redirect(`${IMPORTACION_BASE}/login`);
}
