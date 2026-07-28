import { type NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getUser } from "@/lib/supabase/server";
import { hashPinBodySchema } from "@/lib/validations/nfc";

export const dynamic = "force-dynamic";

/**
 * Hashea un PIN con bcrypt (salt 10). Misma forma que vehiculos.pin_hash.
 * Solo autenticado; no persiste nada.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const body: unknown = await request.json();
    const parsed = hashPinBodySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "PIN de al menos 4 dígitos requerido." },
        { status: 400 }
      );
    }

    const salt = await bcrypt.genSalt(10);
    const pinHash = await bcrypt.hash(parsed.data.pin, salt);

    return NextResponse.json({ pinHash });
  } catch {
    return NextResponse.json(
      { error: "Error al procesar la clave de seguridad." },
      { status: 500 }
    );
  }
}
