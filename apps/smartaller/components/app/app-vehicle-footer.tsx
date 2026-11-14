import Link from "next/link";
import { CategoriaTile, getCategoriaVisual } from "@/components/icons/categorias";
import type { TipoVehiculo } from "@/lib/vehicles/types";

type AppVehicleFooterProps = {
  titulo: string;
  placa: string;
  tipoVehiculo: TipoVehiculo;
  chatHref?: string;
};

export function AppVehicleFooter({
  titulo,
  placa,
  tipoVehiculo,
  chatHref = "/app",
}: AppVehicleFooterProps) {
  const { Icon: ChatIcon } = getCategoriaVisual("chat");

  return (
    <footer className="fixed bottom-0 left-0 right-0 z-30 mx-auto max-w-lg border-t border-zinc-200/80 bg-white/95 px-4 py-3 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] backdrop-blur-md">
      <div className="flex items-center gap-3">
        <CategoriaTile id={tipoVehiculo} className="h-11 w-11" iconClassName="h-6 w-6" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm text-zinc-400">{titulo}</p>
          <p className="truncate text-xs text-zinc-300">{placa}</p>
        </div>
        <Link
          href={chatHref}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg shadow-blue-600/30 transition hover:bg-blue-500"
          aria-label="Chat Smartaller"
        >
          <ChatIcon className="h-5 w-5" />
        </Link>
      </div>
    </footer>
  );
}
