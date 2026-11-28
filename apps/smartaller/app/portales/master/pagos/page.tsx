import { redirect } from "next/navigation";
import Link from "next/link";
import { listMasterTalleresAction } from "@/app/actions/portal-master";
import { listExoneracionesAction } from "@/app/actions/pagos-admin";
import { PortalShell } from "@/components/portal/PortalShell";
import { MasterPagosQueue, type ReportePagoAdmin } from "@/components/portal/MasterPagosQueue";
import { MasterExoneracionesPanel } from "@/components/portal/MasterExoneracionesPanel";
import { requireMasterVerTodo } from "@/lib/portal/roles";
import { getUser } from "@/lib/supabase/server";
import { getBrand } from "@/lib/brand";
import { listReportesPago } from "@/lib/billing/reportes";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

async function withEmails(reportes: Awaited<ReturnType<typeof listReportesPago>>["reportes"]): Promise<ReportePagoAdmin[]> {
  if (reportes.length === 0) return [];
  const admin = createAdminClient();
  const emails = new Map<string, string | null>();
  const tallerNombres = new Map<string, string>();

  await Promise.all(
    [...new Set(reportes.map((r) => r.user_id))].map(async (userId) => {
      const { data } = await admin.auth.admin.getUserById(userId);
      emails.set(userId, data.user?.email ?? null);
    })
  );

  const tallerIds = [
    ...new Set(reportes.map((r) => r.taller_id).filter((id): id is string => Boolean(id))),
  ];
  if (tallerIds.length > 0) {
    const { data } = await admin.from("talleres").select("id, nombre").in("id", tallerIds);
    for (const t of data ?? []) tallerNombres.set(t.id, t.nombre);
  }

  return reportes.map((r) => ({
    ...r,
    email: emails.get(r.user_id) ?? null,
    tallerNombre: r.taller_id ? tallerNombres.get(r.taller_id) ?? null : null,
  }));
}

export default async function PortalMasterPagosPage() {
  const user = await getUser();
  if (!user) redirect("/login?next=/portales/master/pagos");

  const gate = await requireMasterVerTodo();
  if (!gate.ok) {
    return (
      <PortalShell title="Pagos" subtitle={gate.error}>
        <Link href="/portales" className="text-sm text-cyan-400 hover:underline">
          {getBrand().copy.portalesBackLabel}
        </Link>
      </PortalShell>
    );
  }

  const [reportesRes, talleresRes, exoRes] = await Promise.all([
    listReportesPago({ limit: 80 }),
    listMasterTalleresAction(),
    listExoneracionesAction(),
  ]);

  const reportes = await withEmails(reportesRes.reportes);
  const pendientes = reportes.filter((r) => r.estado === "pendiente");
  const otros = reportes.filter((r) => r.estado !== "pendiente");
  const talleres = talleresRes.success ? talleresRes.activos : [];

  return (
    <PortalShell
      title="Pagos y exoneraciones"
      subtitle="Confirma Pago Móvil y exonera clientes o talleres. Solo máster con ver_todo."
      backHref="/portales/master"
    >
      {!reportesRes.schemaReady ? (
        <p className="mb-6 rounded-xl border border-amber-900/40 bg-amber-950/20 px-4 py-3 text-sm text-amber-100">
          Falta aplicar la migración `20261128010000_manual_payment_confirmation.sql` en el SQL
          Editor de Supabase.
        </p>
      ) : null}

      <section className="mb-10">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
          Pendientes ({pendientes.length})
        </h2>
        <div className="mt-3">
          <MasterPagosQueue reportes={pendientes} />
        </div>
      </section>

      {exoRes.ok ? (
        <MasterExoneracionesPanel talleres={talleres} rows={exoRes.rows} />
      ) : (
        <p className="mb-10 text-sm text-amber-200">{exoRes.error}</p>
      )}

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
          Historial reciente
        </h2>
        <div className="mt-3">
          <MasterPagosQueue reportes={otros} />
        </div>
      </section>
    </PortalShell>
  );
}
