import type { ConfigTipoVehiculo, TipoVehiculo } from "@/lib/vehicles/types";

const MODULOS = {
  aceite: { id: "aceite" as const, label: "Aceite de motor" },
  neumaticos: { id: "neumaticos" as const, label: "Neumáticos" },
  balanceo: {
    id: "balanceo" as const,
    label: "Balanceo",
    disponibleDesdeVisita: 1,
  },
  rotacion: {
    id: "rotacion" as const,
    label: "Rotación",
    disponibleDesdeVisita: 1,
  },
  alineacion: {
    id: "alineacion" as const,
    label: "Alineación",
    disponibleDesdeVisita: 1,
  },
  bateria: { id: "bateria" as const, label: "Batería" },
  fluidos: { id: "fluidos" as const, label: "Inspección de fluidos" },
  cadena: { id: "cadena" as const, label: "Cadena / transmisión" },
  frenos: { id: "frenos" as const, label: "Frenos" },
  hidraulico: { id: "hidraulico" as const, label: "Sistema hidráulico" },
  filtros: { id: "filtros" as const, label: "Filtros" },
  orugas: { id: "orugas" as const, label: "Orugas / tren de rodaje" },
};

export const CONFIG_TIPOS_VEHICULO: Record<TipoVehiculo, ConfigTipoVehiculo> = {
  auto: {
    tipo: "auto",
    label: "Automóvil",
    labelCorto: "Auto",
    unidadOdometro: "km",
    ruedas: 4,
    incluyeRepuesto: true,
    modulos: [
      MODULOS.aceite,
      MODULOS.neumaticos,
      MODULOS.balanceo,
      MODULOS.rotacion,
      MODULOS.alineacion,
      MODULOS.bateria,
      MODULOS.fluidos,
    ],
  },
  moto: {
    tipo: "moto",
    label: "Motocicleta",
    labelCorto: "Moto",
    unidadOdometro: "km",
    ruedas: 2,
    incluyeRepuesto: false,
    modulos: [
      MODULOS.aceite,
      MODULOS.neumaticos,
      MODULOS.cadena,
      MODULOS.frenos,
      MODULOS.bateria,
    ],
  },
  bicicleta: {
    tipo: "bicicleta",
    label: "Bicicleta",
    labelCorto: "Bici",
    unidadOdometro: "km",
    ruedas: 2,
    incluyeRepuesto: false,
    modulos: [MODULOS.cadena, MODULOS.frenos, MODULOS.neumaticos],
  },
  patinete: {
    tipo: "patinete",
    label: "Patinete eléctrico",
    labelCorto: "Patinete",
    unidadOdometro: "km",
    ruedas: 2,
    incluyeRepuesto: false,
    modulos: [MODULOS.bateria, MODULOS.neumaticos, MODULOS.frenos],
  },
  tractor: {
    tipo: "tractor",
    label: "Tractor",
    labelCorto: "Tractor",
    unidadOdometro: "horas",
    ruedas: 4,
    incluyeRepuesto: false,
    modulos: [
      MODULOS.aceite,
      MODULOS.hidraulico,
      MODULOS.filtros,
      MODULOS.neumaticos,
      MODULOS.frenos,
    ],
  },
  maquinaria_pesada: {
    tipo: "maquinaria_pesada",
    label: "Maquinaria pesada",
    labelCorto: "Maquinaria",
    unidadOdometro: "horas",
    ruedas: 4,
    incluyeRepuesto: false,
    modulos: [
      MODULOS.aceite,
      MODULOS.hidraulico,
      MODULOS.filtros,
      MODULOS.orugas,
      MODULOS.frenos,
    ],
  },
  jumbo: {
    tipo: "jumbo",
    label: "Jumbo / autobús",
    labelCorto: "Jumbo",
    unidadOdometro: "km",
    ruedas: 6,
    incluyeRepuesto: true,
    modulos: [
      MODULOS.aceite,
      MODULOS.neumaticos,
      MODULOS.frenos,
      MODULOS.bateria,
      MODULOS.fluidos,
    ],
  },
};

export function getConfigTipoVehiculo(tipo: TipoVehiculo): ConfigTipoVehiculo {
  return CONFIG_TIPOS_VEHICULO[tipo];
}

export function listarTiposVehiculo(): ConfigTipoVehiculo[] {
  return Object.values(CONFIG_TIPOS_VEHICULO);
}
