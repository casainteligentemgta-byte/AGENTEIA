import { redirect } from "next/navigation";
import { IMPORTACION_BASE } from "@/lib/importacion/paths";

export default function HomePage() {
  redirect(IMPORTACION_BASE);
}
