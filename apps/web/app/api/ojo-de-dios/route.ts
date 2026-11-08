import { authorizeOjoDeDios, getOjoDeDiosSessionUser } from "@/lib/ojo-de-dios/auth";
import { accessErrorResponse, jsonPrivate } from "@/lib/ojo-de-dios/http";
import { getOjoDeDiosSnapshot } from "@/lib/ojo-de-dios/service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const access = await authorizeOjoDeDios();
  if (!access.ok) return accessErrorResponse(access.status);

  const user = await getOjoDeDiosSessionUser();
  const snapshot = await getOjoDeDiosSnapshot(user);
  return jsonPrivate(snapshot);
}
