"use server";

import { revalidatePath } from "next/cache";
import { getUser } from "@/lib/supabase/server";
import {
  ensureTallerForUser,
  updateTallerNombre,
  updateTallerTipoIndustria,
  regenerarCodigoVinculo,
} from "@/lib/taller";
import type { TipoIndustria } from "@/lib/platform/types";

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
    revalidatePath("/dashboard/mantenimientos");
  }
  return result;
}

export async function updateTipoIndustriaAction(tipoIndustria: TipoIndustria) {
  const result = await updateTallerTipoIndustria(tipoIndustria);
  if (result.ok) {
    revalidatePath("/dashboard/configuracion");
    revalidatePath("/dashboard/mantenimientos");
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
