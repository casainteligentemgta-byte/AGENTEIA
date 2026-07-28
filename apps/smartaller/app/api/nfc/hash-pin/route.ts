import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { hashPin } from "@/lib/nfc/crypto";
import { hashPinBodySchema } from "@/lib/validations/nfc";

export const dynamic = "force-dynamic";

/**
 * Hashea un PIN con bcrypt (mismo formato que vehiculos.pin_hash / nfc_stickers.pin_hash).
 * Solo autenticado; no persiste nada. Preferible asignar PIN vía Server Action.
 */
export async function POST(req: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const parsed = hashPinBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "PIN inválido" },
      { status: 400 }
    );
  }

  const hash = await hashPin(parsed.data.pin);
  return NextResponse.json({ hash });
}
