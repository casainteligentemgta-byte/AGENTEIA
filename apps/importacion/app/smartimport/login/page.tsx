import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { DemoLoginHint } from "@/components/portal/DemoLoginHint";
import { ImportacionLoginForm } from "./importacion-login-form";

export default function ImportacionLoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(ellipse_at_top,_rgba(8,145,178,0.14),_transparent_50%),linear-gradient(180deg,#070b12_0%,#0a1628_45%,#070b12_100%)] px-4 py-10">
      <div className="w-full max-w-md">
        <Suspense fallback={null}>
          <DemoLoginHint />
        </Suspense>
        <Suspense
          fallback={
            <div className="flex items-center gap-2 text-sm text-zinc-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Cargando…
            </div>
          }
        >
          <ImportacionLoginForm />
        </Suspense>
      </div>
    </main>
  );
}
