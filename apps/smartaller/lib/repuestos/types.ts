export type Repuesto = {
  id: string;
  taller_id: string;
  nombre: string;
  sku: string | null;
  unidad: string;
  precio_venta: number;
  stock_actual: number;
  stock_minimo: number;
  activo: boolean;
  created_at: string;
};

export type MantenimientoRepuestoLinea = {
  id: string;
  mantenimiento_id: string;
  repuesto_id: string | null;
  nombre: string;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
  created_at: string;
};

export type RepuestoLineaInput = {
  repuestoId?: string;
  nombre: string;
  cantidad: number;
  precioUnitario: number;
};
