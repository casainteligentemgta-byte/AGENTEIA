import { authorizeOjoDeDios, getOjoDeDiosSessionUser } from "@/lib/ojo-de-dios/auth";
import { accessErrorResponse, jsonPrivate } from "@/lib/ojo-de-dios/http";
import { consumeRateLimit, isSameOriginMutation } from "@/lib/ojo-de-dios/rate-limit";
import { getOjoDeDiosSnapshot } from "@/lib/ojo-de-dios/service";
import { clearPublicCache } from "@/lib/ojo-de-dios/cache";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: Request) {
  const access = await authorizeOjoDeDios();
  if (!access.ok) return accessErrorResponse(access.status);

  if (!isSameOriginMutation(request.headers, request.url)) {
    return jsonPrivate({ error: "Solicitud rechazada." }, 403);
  }

  const key = access.userId ?? request.headers.get("x-forwarded-for") ?? "anon";
  if (!consumeRateLimit(`ojo-refresh:${key}`)) {
    return jsonPrivate({ error: "Demasiadas actualizaciones. Espera unos minutos." }, 429);
  }

  clearPublicCache();
  const user = await getOjoDeDiosSessionUser();
  const snapshot = await getOjoDeDiosSnapshot(user);
  return jsonPrivate(snapshot);
}
