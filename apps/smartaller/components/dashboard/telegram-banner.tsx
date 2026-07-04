import Link from "next/link";
import { AlertTriangle } from "lucide-react";

type TelegramBannerProps = {
  linked: boolean;
};

export function TelegramBanner({ linked }: TelegramBannerProps) {
  if (linked) return null;

  return (
    <div className="mb-6 flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
      <div className="text-sm">
        <p className="font-medium text-amber-200">Telegram no vinculado</p>
        <p className="mt-1 text-amber-200/70">
          Ve a{" "}
          <Link href="/dashboard/configuracion" className="underline hover:text-amber-100">
            Configuración
          </Link>{" "}
          y envía <code className="rounded bg-zinc-900 px-1">/vincular TU_CODIGO</code> al bot para
          registrar facturas.
        </p>
      </div>
    </div>
  );
}
