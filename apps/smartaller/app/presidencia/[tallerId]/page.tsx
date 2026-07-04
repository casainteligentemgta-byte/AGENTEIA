import Link from "next/link";
import { notFound } from "next/navigation";
import { presidenciaAutorizada } from "@/app/actions/presidencia";
import { PresidenciaAutoRefresh } from "@/components/presidencia/auto-refresh";
import { PresidenciaDashboard } from "@/components/presidencia/dashboard";
import { PresidenciaLogin } from "@/components/presidencia/login";
import {
  fetchMantenimientosRecientes,
  fetchPresidenciaStats,
  fetchRecordatoriosProximos,
  getTallerNombreById,
  tallerExiste,
} from "@/lib/data/presidencia";

export const dynamic = "force-dynamic";

type Props = {
  params: { tallerId: string };
};

export default async function PresidenciaPage({ params }: Props) {
  const { tallerId } = params;

  if (!(await tallerExiste(tallerId))) {
    notFound();
  }

  const autorizada = await presidenciaAutorizada(tallerId);

  if (!autorizada) {
    return (
      <main className="flex min-h-screen items-center bg-zinc-950 px-4 py-12">
        <PresidenciaLogin tallerId={tallerId} />
      </main>
    );
  }

  let error: string | null = null;
  let stats = { serviciosHoy: 0, serviciosMes: 0, vehiculosRegistrados: 0, recordatoriosPendientes: 0 };
  let mantenimientos: Awaited<ReturnType<typeof fetchMantenimientosRecientes>> = [];
  let recordatorios: Awaited<ReturnType<typeof fetchRecordatoriosProximos>> = [];
  let tallerNombre = "Taller";

  try {
    [stats, mantenimientos, recordatorios, tallerNombre] = await Promise.all([
      fetchPresidenciaStats(tallerId),
      fetchMantenimientosRecientes(tallerId),
      fetchRecordatoriosProximos(tallerId),
      getTallerNombreById(tallerId),
    ]);
  } catch (e) {
    error = e instanceof Error ? e.message : "Error cargando datos";
  }

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-8 sm:px-6 lg:px-8">
      <PresidenciaAutoRefresh />
      <nav className="mx-auto mb-6 flex max-w-7xl items-center justify-between text-sm">
        <Link href="/" className="text-zinc-500 hover:text-zinc-300">
          ← SmartTaller
        </Link>
        <Link href="/cliente" className="text-zinc-500 hover:text-zinc-300">
          Portal cliente
        </Link>
      </nav>

      <div className="mx-auto max-w-7xl">
        {error ? (
          <div className="glass rounded-2xl border border-red-900/50 p-6 text-red-200">
            <p className="font-semibold">No se pudo cargar el panel</p>
            <p className="mt-1 text-sm">{error}</p>
          </div>
        ) : (
          <PresidenciaDashboard
            stats={stats}
            mantenimientos={mantenimientos}
            recordatorios={recordatorios}
            tallerNombre={tallerNombre}
          />
        )}
      </div>
    </main>
  );
}
