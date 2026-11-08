import { isOjoDeDiosEnabled } from "@/lib/auth/flags";
import { AgentePageClient } from "./agente-client";

export const dynamic = "force-dynamic";

export default function AgentePage() {
  return <AgentePageClient showOjoDeDios={isOjoDeDiosEnabled()} />;
}
