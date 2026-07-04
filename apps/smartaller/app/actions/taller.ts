"use server";

import { revalidatePath } from "next/cache";
import { getUser } from "@/lib/supabase/server";
import {
  ensureTallerForUser,
  getMyTaller,
  updateTallerNombre,
  regenerarCodigoVinculo,
} from "@/lib/taller";

export async function initTallerAction() {
  const user = await getUser();
  if (!user) return { taller: null };
  const taller = await ensureTallerForUser(user.id);
  return { taller };
}

export async function getTallerAction() {
  const user = await getUser();
  if (!user) return { taller: null };
  await ensureTallerForUser(user.id);
  const taller = await getMyTaller();
  return { taller };
}

export async function updateNombreTallerAction(nombre: string) {
  const result = await updateTallerNombre(nombre);
  if (result.ok) {
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/configuracion");
  }
  return result;
}

export async function regenerarCodigoAction() {
  const result = await regenerarCodigoVinculo();
  if (result.codigo) {
    revalidatePath("/dashboard/configuracion");
  }
  return result;
}
