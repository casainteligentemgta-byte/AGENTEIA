import Link from "next/link";
import { marcarNotificacionLeidaAction } from "@/app/actions/pagos";
import type { NotificacionUsuario } from "@/lib/data/notificaciones";
import { vencimientoCerca } from "@/lib/billing/periodo";

type SuscripcionBannerProps = {
  vencimiento: string | null;
  diasRestantes: number | null;
  notificaciones?: NotificacionUsuario[];
  hrefPago?: string;
  className?: string;
};

function DismissButton({ id }: { id: string }) {
  return (
    <form
      action={async () => {
        "use server";
        await marcarNotificacionLeidaAction(id);
      }}
    >
      <button type="submit" className="text-xs text-amber-200/80 underline">
        Ocultar
      </button>
    </form>
  );
}

export function SuscripcionBanner({
  vencimiento,
  diasRestantes,
  notificaciones = [],
  hrefPago = "/app",
  className,
}: SuscripcionBannerProps) {
  const cerca = vencimientoCerca(vencimiento);
  if (!cerca && notificaciones.length === 0) return null;

  const fecha = vencimiento
    ? new Date(vencimiento).toLocaleDateString("es-VE")
    : null;

  return (
    <div className={className ? `${className} space-y-2` : "space-y-2"}>
      {cerca && diasRestantes != null ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-950/40 px-4 py-3 text-sm text-amber-100">
          <p className="font-medium">
            {diasRestantes <= 0
              ? "Tu plan venció. Renueva con Pago Móvil para seguir usando el servicio."
              : `Tu plan vence en ${diasRestantes} día${diasRestantes === 1 ? "" : "s"}${fecha ? ` (${fecha})` : ""}.`}
          </p>
          <Link href={hrefPago} className="mt-1 inline-block text-xs underline">
            Ver datos de Pago Móvil
          </Link>
        </div>
      ) : null}
      {notificaciones.map((n) => (
        <div
          key={n.id}
          className="flex items-start justify-between gap-3 rounded-xl border border-sky-500/25 bg-sky-950/30 px-4 py-3 text-sm text-sky-100"
        >
          <div>
            <p className="font-medium">{n.titulo}</p>
            <p className="mt-0.5 text-sky-100/80">{n.cuerpo}</p>
          </div>
          <DismissButton id={n.id} />
        </div>
      ))}
    </div>
  );
}
