import Link from "next/link";
import { AppHeader } from "@/components/app/app-header";
import { getUserBikes } from "@/lib/data/smartbike";
import { BIKE_STATUS_LABELS } from "@/lib/smartbike/types";
import { Bike, ChevronRight } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function BicicletasListPage() {
  const bikes = await getUserBikes();

  return (
    <div className="app-bg-light min-h-screen text-zinc-900">
      <AppHeader variant="light" centered />

      <main className="px-4 pb-12 pt-2">
        <h1 className="mb-1 text-xl font-bold">Mis bicicletas</h1>
        <p className="mb-4 text-sm text-zinc-500">SmartBike · desgaste por Strava</p>

        {bikes.length === 0 ? (
          <div className="app-card-white p-6 text-center text-sm text-zinc-500">
            No tienes bicicletas registradas. Ejecuta{" "}
            <code className="text-xs text-brand-700">supabase/seed-smartbike.sql</code> tras la
            migración.
          </div>
        ) : (
          <ul className="space-y-3">
            {bikes.map((bike) => (
              <li key={bike.id}>
                <Link
                  href={`/app/bicicletas/${bike.id}`}
                  className="app-card-white flex items-center gap-3 p-4 transition hover:border-brand-200"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-100 text-brand-700">
                    <Bike className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">
                      {bike.brand} {bike.model}
                    </p>
                    <p className="text-xs text-zinc-500">{BIKE_STATUS_LABELS[bike.status]}</p>
                  </div>
                  <ChevronRight className="h-5 w-5 shrink-0 text-zinc-400" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
