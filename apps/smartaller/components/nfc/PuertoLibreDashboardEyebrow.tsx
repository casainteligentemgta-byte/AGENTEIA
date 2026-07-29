"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";

const DOUBLE_TAP_MS = 350;

type Props = {
  fallbackHref?: string;
};

/** Doble toque / doble clic → atrás (o fallback al dashboard general). */
export function PuertoLibreDashboardEyebrow({ fallbackHref = "/dashboard" }: Props) {
  const router = useRouter();
  const lastTapRef = useRef(0);

  function goBack() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    router.push(fallbackHref);
  }

  function handlePointerUp() {
    const now = Date.now();
    if (now - lastTapRef.current < DOUBLE_TAP_MS) {
      lastTapRef.current = 0;
      goBack();
      return;
    }
    lastTapRef.current = now;
  }

  return (
    <button
      type="button"
      onPointerUp={handlePointerUp}
      onDoubleClick={(e) => {
        e.preventDefault();
        goBack();
      }}
      className="mb-2 inline-flex items-center gap-2 text-cyan-400 transition active:opacity-80"
      aria-label="Doble toque para volver atrás"
      title="Doble toque para volver"
    >
      <ShieldCheck className="h-5 w-5" />
      <span className="text-sm font-medium tracking-wide uppercase">Dashboard</span>
    </button>
  );
}
