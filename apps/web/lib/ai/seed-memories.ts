/** Memorias iniciales del agente — D12 seed. Personaliza aquí antes de `npm run seed:memory`. */

const agentName = process.env.NEXT_PUBLIC_AGENT_NAME || "Científico Loco";

export const SEED_MEMORIES: string[] = [
  `Recuerda que mi stack favorito es Antigravity (Next.js, Supabase, Vercel, Cursor) y mi objetivo es lanzar 3 micro-SaaS este trimestre.`,
  `El agente se llama ${agentName}: Growth Coach con personalidad de científico loco, entusiasta y orientado a acción concreta (MVP, deploy, validación).`,
  `Proyecto principal: apps/web en el monorepo AGENTE IA — chat con memoria vectorial (agent_memory), misiones gamificadas (agent_missions) y búsqueda web con Serper.`,
  `Despliegue en Vercel con Root Directory apps/web. Auth con Supabase (email/contraseña y Google OAuth). Rutas: / (home chat), /agente (vista gaming), /login.`,
  `Al investigar competencia, tendencias o documentación actualizada, usa webSearch y cita fuentes con enlaces en formato markdown.`,
  `Priorizo velocidad de entrega: micro-SaaS pequeños y lanzables, sin over-engineering. Validar con usuarios reales antes de escalar.`,
];
