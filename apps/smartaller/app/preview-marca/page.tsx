import { notFound } from "next/navigation";
import { Car, ListTodo, DollarSign, Wrench } from "lucide-react";
import { BrandLogo } from "@/components/app/brand-logo";
import { AppHeader } from "@/components/app/app-header";
import { AddVehicleForm } from "@/components/app/add-vehicle-form";
import { VehicleCard } from "@/components/app/vehicle-card";
import { VehicleHealthDashboard } from "@/components/app/vehicle-health-dashboard";
import { Sidebar } from "@/components/dashboard/sidebar";
import { StatCard } from "@/components/dashboard/stat-card";
import { JacLogin } from "@/components/jac/jac-login";
import { JacOwnerHome } from "@/components/jac/jac-owner-home";
import { JacTabbar } from "@/components/jac/jac-tabbar";
import { JacWorkshopBoard } from "@/components/jac/jac-workshop-board";
import { getBrand } from "@/lib/brand";
import type { VehiculoUsuario } from "@/lib/vehicles/types";
import type { VehicleHealthSummary } from "@/lib/vehicles/vehicle-health";

export const dynamic = "force-dynamic";

function previewEnabled(): boolean {
  if (process.env.ALLOW_BRAND_PREVIEW === "1") return true;
  return process.env.NODE_ENV !== "production";
}

const DEMO_VEHICULO: VehiculoUsuario = {
  id: "preview-jac-1",
  placa: "AA90N90",
  nick: "El de Luis",
  marca: "JAC",
  modelo: "Tepuy Pro",
  color: "Blanco",
  tipo_vehiculo: "auto",
  tipo_activo: "carro",
  serial_alternativo: null,
  unidad_odometro: "km",
  kilometraje_ultimo: 12480,
  horas_motor_ultimo: null,
  horometro_actual: null,
  taller_id: null,
  created_at: "2026-08-01T12:00:00.000Z",
};

const DEMO_SALUD: VehicleHealthSummary = {
  peorEstado: "atencion",
  recordatoriosUrgentes: 1,
  categorias: [
    {
      id: "aceite",
      label: "Aceite",
      estado: "bien",
      fechaRevision: "2026-09-12",
      notas: null,
      fuente: "categorias",
    },
    {
      id: "neumaticos",
      label: "Cauchos",
      estado: "atencion",
      fechaRevision: "2026-08-02",
      notas: null,
      fuente: "categorias",
    },
    {
      id: "bateria",
      label: "Batería",
      estado: "bien",
      fechaRevision: "2026-07-20",
      notas: null,
      fuente: "categorias",
    },
    {
      id: "general",
      label: "Revisión",
      estado: "atencion",
      fechaRevision: "2026-12-01",
      notas: null,
      fuente: "recordatorio",
    },
  ],
};

const CITA_HOY = (() => {
  const d = new Date();
  d.setHours(10, 0, 0, 0);
  return d.toISOString();
})();

function JacPreview() {
  return (
    <div className="bg-[#f3f4f8] text-[#1c1c22]">
      <section id="login" className="min-h-screen overflow-hidden">
        <JacLogin />
      </section>

      <section id="dueno" className="relative mx-auto min-h-screen max-w-lg overflow-hidden">
        <JacOwnerHome
          nombre="Luis"
          vehicles={[
            {
              vehiculo: DEMO_VEHICULO,
              salud: DEMO_SALUD,
              titulo: "Tepuy Pro",
            },
          ]}
          alertas={[
            {
              id: "a1",
              vehiculoId: DEMO_VEHICULO.id,
              vehiculoLabel: "Cauchos · Tepuy Pro",
              placa: DEMO_VEHICULO.placa,
              fecha_programada: CITA_HOY,
              kilometraje_objetivo: 800,
              estado: "pendiente",
              prioridad: "atencion",
              diasRestantes: 0,
            },
          ]}
          proximaCita={{
            id: "cita-1",
            fecha_programada: CITA_HOY,
            kilometraje_objetivo: 1200,
            estado: "pendiente",
          }}
        />
        <JacTabbar embedded />
      </section>

      <section id="alta" className="mx-auto min-h-screen max-w-lg px-4 py-8">
        <div className="mb-6 flex justify-center">
          <BrandLogo theme="light" />
        </div>
        <AddVehicleForm />
      </section>

      <section id="dashboard" className="min-h-screen bg-[#f3f4f8]">
        <div className="mx-auto flex min-h-screen max-w-[1600px] flex-col md:flex-row">
          <Sidebar
            userEmail="taller@jac.ve"
            tallerNombre="Concesionario JAC Caracas"
          />
          <main className="min-w-0 flex-1">
            <JacWorkshopBoard
              tallerNombre="Concesionario JAC Caracas"
              bahia={2}
              citas={3}
              porConfirmar={1}
              rows={[
                {
                  id: "1",
                  modelo: "Tepuy Pro",
                  dueno: "Luis",
                  placa: "AA90N90",
                  servicio: "Cauchos",
                  hora: "10:00 a. m.",
                  chip: "bahia",
                },
                {
                  id: "2",
                  modelo: "Arena Sport",
                  dueno: "Carla",
                  placa: "ABC12D",
                  servicio: "Aceite",
                  hora: "11:30 a. m.",
                  chip: "esperando",
                },
                {
                  id: "3",
                  modelo: "GX7",
                  dueno: "Pedro",
                  placa: "JAC456",
                  servicio: "Frenos",
                  hora: "2:00 p. m.",
                  chip: "confirmada",
                },
                {
                  id: "4",
                  modelo: "Nevado Pro",
                  dueno: "Ana",
                  placa: "XYZ99",
                  servicio: "Alineación",
                  hora: "4:00 p. m.",
                  chip: "porConfirmar",
                },
              ]}
            />
          </main>
        </div>
      </section>
    </div>
  );
}

function SmartTallerPreview() {
  const brand = getBrand();
  return (
    <div className="space-y-10 bg-zinc-950 pb-16">
      <section id="login" className="flex min-h-screen items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <BrandLogo size="md" theme="dark" />
          <p className="mt-3 text-sm text-zinc-500">{brand.copy.loginTallerSubtitle}</p>
          <div className="glass mt-6 rounded-2xl p-6 sm:p-8">
            <p className="mb-4 text-xs font-medium uppercase tracking-wide text-zinc-500">
              Vista previa · {brand.copy.name}
            </p>
            <label className="mb-1.5 block text-sm text-zinc-400">Correo electrónico</label>
            <input
              readOnly
              value="taller@smarttaller.xyz"
              className="mb-4 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm"
            />
            <label className="mb-1.5 block text-sm text-zinc-400">Contraseña</label>
            <input
              readOnly
              type="password"
              value="password"
              className="mb-6 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm"
            />
            <button
              type="button"
              className="w-full rounded-xl bg-blue-600 py-2.5 text-sm font-medium text-white"
            >
              {brand.copy.loginTallerCta}
            </button>
          </div>
        </div>
      </section>

      <section id="dashboard" className="min-h-screen bg-zinc-950">
        <div className="mx-auto flex min-h-screen max-w-[1600px] flex-col md:flex-row">
          <Sidebar defaultOpen userEmail="taller@smarttaller.xyz" tallerNombre="SmartTaller" />
          <main className="min-w-0 flex-1 p-4 sm:p-8">
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Dashboard</h1>
            <p className="mt-1 text-zinc-500">Resumen de tu taller en tiempo real</p>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard label="Vehículos registrados" value="18" icon={Car} />
              <StatCard
                label="En mantenimiento"
                value="3"
                icon={Wrench}
                trend="Vehículos con servicio activo hoy"
              />
              <StatCard
                label="Tareas por ejecutar"
                value="5"
                icon={ListTodo}
                trend="Recordatorios pendientes"
              />
              <StatCard label="Ingresos del mes" value="$4.200" icon={DollarSign} />
            </div>
          </main>
        </div>
      </section>

      <section id="dueno" className="app-bg-dark min-h-screen text-zinc-100">
        <div className="mx-auto min-h-screen max-w-lg">
          <AppHeader centered />
          <main className="px-4 pb-10 pt-2">
            <VehicleHealthDashboard salud={DEMO_SALUD} tituloVehiculo="Hilux de Luis" />
            <div className="mt-4">
              <VehicleCard
                vehiculo={{ ...DEMO_VEHICULO, marca: "Toyota", modelo: "Hilux", nick: "Hilux de Luis" }}
                salud={DEMO_SALUD}
                alertasUrgentes={1}
              />
            </div>
          </main>
        </div>
      </section>

      <section id="alta" className="app-bg-dark min-h-screen">
        <div className="mx-auto max-w-lg px-4 py-8">
          <div className="mb-6 flex justify-center">
            <BrandLogo theme="dark" />
          </div>
          <AddVehicleForm />
        </div>
      </section>
    </div>
  );
}

export default function PreviewMarcaPage() {
  if (!previewEnabled()) notFound();
  const brand = getBrand();
  if (brand.id === "jac") return <JacPreview />;
  return <SmartTallerPreview />;
}
