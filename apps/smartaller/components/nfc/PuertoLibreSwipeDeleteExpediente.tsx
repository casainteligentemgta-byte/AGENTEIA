"use client";

import { useRouter } from "next/navigation";
import {
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  useRef,
  useState,
  useTransition,
} from "react";
import { Loader2, Trash2 } from "lucide-react";
import { deletePuertoLibreVehiculoAction } from "@/app/actions/nfc/importacion-vehiculo";

type Props = {
  vehiculoId: string;
  codigo: string;
  children: ReactNode;
};

const DELETE_ACTION_WIDTH = 96;
const OPEN_SWIPE_THRESHOLD = DELETE_ACTION_WIDTH / 2;

/**
 * Fila táctil: al deslizar a la izquierda revela una única acción destructiva.
 * El botón permanece oculto en reposo para evitar eliminaciones accidentales.
 */
export function PuertoLibreSwipeDeleteExpediente({
  vehiculoId,
  codigo,
  children,
}: Props) {
  const router = useRouter();
  const startX = useRef<number | null>(null);
  const [offset, setOffset] = useState(0);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    startX.current = event.clientX;
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (startX.current === null) return;
    const nextOffset = Math.max(
      -DELETE_ACTION_WIDTH,
      Math.min(0, event.clientX - startX.current)
    );
    setOffset(nextOffset);
  }

  function finishSwipe() {
    if (startX.current === null) return;
    const shouldOpen = offset <= -OPEN_SWIPE_THRESHOLD;
    setOpen(shouldOpen);
    setOffset(shouldOpen ? -DELETE_ACTION_WIDTH : 0);
    startX.current = null;
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deletePuertoLibreVehiculoAction({ vehiculoId });
      if (!result.success) {
        setOpen(false);
        setOffset(0);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="relative overflow-hidden rounded-xl">
      <div className="absolute inset-y-0 right-0 flex w-24 items-stretch">
        <button
          type="button"
          disabled={pending}
          onClick={handleDelete}
          className="flex w-full flex-col items-center justify-center gap-1 bg-red-600 px-2 text-xs font-semibold text-white transition hover:bg-red-500 disabled:opacity-60"
          aria-label={`Borrar ${codigo}`}
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          Borrar
        </button>
      </div>
      <div
        className="relative touch-pan-y bg-zinc-950 transition-transform duration-200"
        style={{ transform: `translateX(${open ? -DELETE_ACTION_WIDTH : offset}px)` }}
        onClickCapture={(event) => {
          if (!open) return;
          event.preventDefault();
          setOpen(false);
          setOffset(0);
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishSwipe}
        onPointerCancel={finishSwipe}
      >
        {children}
      </div>
    </div>
  );
}
