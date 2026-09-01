export type DashboardFichaIdentidad = {
  marca: string | null;
  modelo: string | null;
  color: string | null;
  vin: string | null;
};

function cleanField(value: string | null | undefined): string | null {
  const s = (value ?? "").trim();
  if (!s || s === "—" || /^POR-COMPLETAR$/i.test(s)) return null;
  return s;
}

/** Marca, modelo, color y VIN, cada uno en su línea bajo el expediente. */
export function dashboardFichaIdentidad(v: {
  marca?: string | null;
  modelo?: string | null;
  color?: string | null;
  vin?: string | null;
}): DashboardFichaIdentidad {
  return {
    marca: cleanField(v.marca),
    modelo: cleanField(v.modelo),
    color: cleanField(v.color),
    vin: cleanField(v.vin),
  };
}

export function dashboardFichaLineas(ficha: DashboardFichaIdentidad): string[] {
  return [ficha.marca, ficha.modelo, ficha.color, ficha.vin].filter(
    (x): x is string => Boolean(x)
  );
}

export function dashboardFichaSearchText(ficha: DashboardFichaIdentidad): string {
  return dashboardFichaLineas(ficha).join(" ");
}
