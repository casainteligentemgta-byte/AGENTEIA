"use server";

import { revalidatePath } from "next/cache";
import { getUser } from "@/lib/supabase/server";
import {
  ensureTallerForUser,
  updateTallerNombre,
  regenerarCodigoVinculo,
} from "@/lib/taller";

export async function initTallerAction() {
  const user = await getUser();
  if (!user) return { taller: null, error: "No autenticado" };
  return ensureTallerForUser(user.id);
}

export async function getTallerAction() {
  const user = await getUser();
  if (!user) return { taller: null, error: "No autenticado" };
  return ensureTallerForUser(user.id);
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
