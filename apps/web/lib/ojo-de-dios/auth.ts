import { createClient } from "@/lib/supabase/server";
import {
  resolveOjoDeDiosAccessFromEnv,
  type SessionUser,
} from "./access";
import type { OjoDeDiosAccess } from "./types";

export async function getOjoDeDiosSessionUser(): Promise<SessionUser | null> {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    return { id: user.id, email: user.email ?? null };
  } catch {
    return null;
  }
}

export async function authorizeOjoDeDios(): Promise<OjoDeDiosAccess> {
  const user = await getOjoDeDiosSessionUser();
  return resolveOjoDeDiosAccessFromEnv(user);
}
