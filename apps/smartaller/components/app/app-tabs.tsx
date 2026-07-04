"use client";

type AppTabsProps = {
  active?: "vehiculos" | "timeline";
};

export function AppTabs({ active = "vehiculos" }: AppTabsProps) {
  return (
    <div className="relative flex overflow-hidden rounded-2xl bg-[#0f1f38] p-1">
      <div
        className={`relative flex-1 py-2.5 text-center text-sm font-semibold transition ${
          active === "vehiculos" ? "text-white" : "text-zinc-500"
        }`}
      >
        {active === "vehiculos" && (
          <span className="absolute inset-0 rounded-xl bg-[#1a3055] shadow-inner" />
        )}
        <span className="relative">Mis vehículos</span>
      </div>
      <div
        className={`flex-1 py-2.5 text-center text-sm transition ${
          active === "timeline" ? "font-semibold text-white" : "text-zinc-500"
        }`}
      >
        Timeline
        {active !== "timeline" && (
          <span className="mt-0.5 block text-[10px] font-normal text-zinc-600">Próximamente</span>
        )}
      </div>
    </div>
  );
}
