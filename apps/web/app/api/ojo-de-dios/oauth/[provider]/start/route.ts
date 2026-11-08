import { authorizeOjoDeDios } from "@/lib/ojo-de-dios/auth";
import { isAllowedOAuthProvider } from "@/lib/ojo-de-dios/config";
import { accessErrorResponse, jsonPrivate } from "@/lib/ojo-de-dios/http";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: { provider: string } }
) {
  const access = await authorizeOjoDeDios();
  if (!access.ok) return accessErrorResponse(access.status);

  const provider = params.provider?.toLowerCase() ?? "";
  if (!isAllowedOAuthProvider(provider)) {
    return jsonPrivate({ error: "Proveedor no permitido." }, 400);
  }

  return jsonPrivate(
    {
      error:
        "OAuth persistente no está habilitado: no hay almacén cifrado ni tablas nuevas. Configura las variables de entorno del servidor (ver .env.example).",
      provider,
    },
    501
  );
}
