import Link from "next/link";
import { PresidenciaAutoRefresh } from "@/components/presidencia/auto-refresh";
import { PresidenciaDashboard } from "@/components/presidencia/dashboard";
import { PresidenciaLogin } from "@/components/presidencia/login";
import { presidenciaAutorizada } from "@/app/actions/presidencia";
import {
  fetchMantenimientosRecientes,
  fetchPresidenciaStats,
  fetchRecordatoriosProximos,
  getTallerNombre,
} from "@/lib/data/presidencia";
import type { Mantenimiento, PresidenciaStats, RecordatorioConPlaca } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function PresidenciaPage() {
  const autorizada = await presidenciaAutorizada();

  if (!autorizada) {
    return (
      <main className="mx-auto flex min-h-screen max-w-lg items-center px-4 py-12">
        <PresidenciaLogin />
      </main>
    );
  }

  let stats: PresidenciaStats;
  let mantenimientos: Mantenimiento[];
  let recordatorios: RecordatorioConPlaca[];
  let error: string | null = null;

  try {
    [stats, mantenimientos, recordatorios] = await Promise.all([
      fetchPresidenciaStats(),
      fetchMantenimientosRecientes(),
      fetchRecordatoriosProximos(),
    ]);
  } catch (e) {
    error = e instanceof Error ? e.message : "Error cargando datos";
    stats = { serviciosHoy: 0, serviciosMes: 0, vehiculosRegistrados: 0, recordatoriosPendientes: 0 };
    mantenimientos = [];
    recordatorios = [];
  }

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <PresidenciaAutoRefresh />
      <nav className="mb-6 flex items-center justify-between text-sm">
        <Link href="/" className="font-medium text-brand-600 hover:text-brand-700">
          ← Inicio
        </Link>
        <Link href="/cliente" className="text-slate-500 hover:text-slate-700">
          Portal cliente
        </Link>
      </nav>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-800">
          <p className="font-semibold">No se pudo cargar el panel</p>
          <p className="mt-1 text-sm">{error}</p>
          <p className="mt-3 text-sm">
            Configura <code className="rounded bg-red-100 px-1">TALLER_TELEGRAM_CHAT_ID</code> en{" "}
            <code className="rounded bg-red-100 px-1">.env.local</code>.
          </p>
        </div>
      ) : (
        <PresidenciaDashboard
          stats={stats}
          mantenimientos={mantenimientos}
          recordatorios={recordatorios}
          tallerNombre={getTallerNombre()}
        />
      )}
    </main>
  );
}
