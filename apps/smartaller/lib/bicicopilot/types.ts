export const BIKE_COMPONENT_TYPES = [
  "cadena",
  "pastillas_freno",
  "neumatico",
  "suspension",
  "rodamientos",
] as const;

export type BikeComponentType = (typeof BIKE_COMPONENT_TYPES)[number];

export const BIKE_COMPONENT_STATUSES = ["green", "yellow", "red"] as const;
export type BikeComponentStatus = (typeof BIKE_COMPONENT_STATUSES)[number];

export const BIKE_STATUSES = ["active", "stolen", "sold"] as const;
export type BikeStatus = (typeof BIKE_STATUSES)[number];

export type Shop = {
  id: string;
  name: string;
  logo_url: string | null;
  address: string | null;
  contact_phone: string | null;
};

export type Bike = {
  id: string;
  user_id: string;
  shop_id: string | null;
  brand: string;
  model: string;
  frame_serial: string;
  color: string | null;
  size: string | null;
  material: string | null;
  status: BikeStatus;
  strava_gear_id: string | null;
  created_at: string;
};

export type BikeComponent = {
  id: string;
  bike_id: string;
  component_type: BikeComponentType;
  brand_model: string;
  accessory_serial: string | null;
  km_accumulated: number;
  km_limit: number;
  status: BikeComponentStatus;
  created_at: string;
};

export type MaintenanceProtocol = {
  id: string;
  bike_id: string;
  shop_id: string;
  mechanic_notes: string | null;
  transmission_checked: boolean;
  brakes_checked: boolean;
  bearings_checked: boolean;
  torque_checked: boolean;
  photo_proof_url: string | null;
  created_at: string;
};

export type BikeWithComponents = Bike & {
  shop: Shop | null;
  components: BikeComponent[];
};

export const COMPONENT_TYPE_LABELS: Record<BikeComponentType, string> = {
  cadena: "Cadena",
  pastillas_freno: "Pastillas de freno",
  neumatico: "Neumático",
  suspension: "Suspensión",
  rodamientos: "Rodamientos",
};

export const BIKE_STATUS_LABELS: Record<BikeStatus, string> = {
  active: "Activa — en uso",
  stolen: "Reportada robada",
  sold: "Vendida / transferida",
};
