import type { RECEPCION_CHECKLIST_SECCION } from "@/lib/schemas/orden-recepcion";

export type ChecklistCatalogItem = {
  id: string;
  seccion: (typeof RECEPCION_CHECKLIST_SECCION)[number];
  subseccion: string;
  etiqueta: string;
  orden: number;
};

/** Catálogo espejo del seed SQL — la UI no depende de una query extra al cargar el formulario */
export const RECEPCION_CHECKLIST_CATALOG: ChecklistCatalogItem[] = [
  { id: "int_luces_interiores", seccion: "interior_electrico", subseccion: "Sistemas eléctricos", etiqueta: "Luces interiores", orden: 10 },
  { id: "int_indicadores", seccion: "interior_electrico", subseccion: "Sistemas eléctricos", etiqueta: "Indicadores", orden: 20 },
  { id: "int_pito_bocinas", seccion: "interior_electrico", subseccion: "Sistemas eléctricos", etiqueta: "Pito de bocinas", orden: 30 },
  { id: "int_aire_acondicionado", seccion: "interior_electrico", subseccion: "Sistemas eléctricos", etiqueta: "Aire acondicionado", orden: 40 },
  { id: "int_rejillas_ac", seccion: "interior_electrico", subseccion: "Sistemas eléctricos", etiqueta: "Rejillas a/c", orden: 50 },
  { id: "int_func_cristales", seccion: "interior_electrico", subseccion: "Sistemas eléctricos", etiqueta: "Funcionamiento de cristales", orden: 60 },
  { id: "int_switch_cristales", seccion: "interior_electrico", subseccion: "Sistemas eléctricos", etiqueta: "Switch de cristales", orden: 70 },
  { id: "int_radio_bocinas", seccion: "interior_electrico", subseccion: "Sistemas eléctricos", etiqueta: "Radio / bocinas", orden: 80 },
  { id: "int_cd_charger", seccion: "interior_electrico", subseccion: "Sistemas eléctricos", etiqueta: "CD charger", orden: 90 },
  { id: "int_seguros", seccion: "interior_electrico", subseccion: "Sistemas eléctricos", etiqueta: "Funcionamiento de seguros", orden: 100 },
  { id: "int_tapasol", seccion: "interior_accesorios", subseccion: "Accesorios y acabados", etiqueta: "Tapasol", orden: 10 },
  { id: "int_beeper", seccion: "interior_accesorios", subseccion: "Accesorios y acabados", etiqueta: "Beeper", orden: 20 },
  { id: "int_porta_vasos", seccion: "interior_accesorios", subseccion: "Accesorios y acabados", etiqueta: "Porta vasos", orden: 30 },
  { id: "int_encendedor", seccion: "interior_accesorios", subseccion: "Accesorios y acabados", etiqueta: "Encendedor", orden: 40 },
  { id: "int_tapa_consola", seccion: "interior_accesorios", subseccion: "Accesorios y acabados", etiqueta: "Tapa consola central", orden: 50 },
  { id: "int_gaveta_ceniceros", seccion: "interior_accesorios", subseccion: "Accesorios y acabados", etiqueta: "Gaveta ceniceros", orden: 60 },
  { id: "int_tapizados_asientos", seccion: "interior_accesorios", subseccion: "Accesorios y acabados", etiqueta: "Tapizados asientos", orden: 70 },
  { id: "int_molduras", seccion: "interior_accesorios", subseccion: "Accesorios y acabados", etiqueta: "Molduras", orden: 80 },
  { id: "int_alfombras", seccion: "interior_accesorios", subseccion: "Accesorios y acabados", etiqueta: "Alfombras", orden: 90 },
  { id: "int_sunroof", seccion: "interior_accesorios", subseccion: "Accesorios y acabados", etiqueta: "Funcionamiento de sunroof", orden: 100 },
  { id: "capot_varilla_aceite", seccion: "bajo_capot", subseccion: "Niveles y componentes", etiqueta: "Varilla de aceite", orden: 10 },
  { id: "capot_varilla_atf", seccion: "bajo_capot", subseccion: "Niveles y componentes", etiqueta: "Varilla ATF", orden: 20 },
  { id: "capot_tapon_aceite_motor", seccion: "bajo_capot", subseccion: "Niveles y componentes", etiqueta: "Tapón aceite motor", orden: 30 },
  { id: "capot_tapa_bomba_direccion", seccion: "bajo_capot", subseccion: "Niveles y componentes", etiqueta: "Tapa bomba de dirección", orden: 40 },
  { id: "capot_tapon_coolant", seccion: "bajo_capot", subseccion: "Niveles y componentes", etiqueta: "Tapón del coolant", orden: 50 },
  { id: "capot_tapa_radiador", seccion: "bajo_capot", subseccion: "Niveles y componentes", etiqueta: "Tapa de radiador", orden: 60 },
  { id: "capot_cover_polo_bateria", seccion: "bajo_capot", subseccion: "Niveles y componentes", etiqueta: "Cover polo batería", orden: 70 },
  { id: "capot_cover_tapa_motor", seccion: "bajo_capot", subseccion: "Niveles y componentes", etiqueta: "Cover tapa de motor", orden: 80 },
  { id: "capot_baterias", seccion: "bajo_capot", subseccion: "Niveles y componentes", etiqueta: "Baterías", orden: 90 },
  { id: "ext_tapa_bumper", seccion: "parte_trasera_exterior", subseccion: "Componentes", etiqueta: "Tapa cobertura bumper", orden: 10 },
  { id: "ext_tapa_bocina_centro_aro", seccion: "parte_trasera_exterior", subseccion: "Componentes", etiqueta: "Tapa bocina / centro aro", orden: 20 },
  { id: "ext_cover_goma_repuesto", seccion: "parte_trasera_exterior", subseccion: "Componentes", etiqueta: "Cover goma de repuesto", orden: 30 },
  { id: "ext_goma_repuesto", seccion: "parte_trasera_exterior", subseccion: "Componentes", etiqueta: "Goma de repuesto", orden: 40 },
  { id: "ext_candado_rueda", seccion: "parte_trasera_exterior", subseccion: "Componentes", etiqueta: "Candado de rueda", orden: 50 },
  { id: "ext_gato", seccion: "parte_trasera_exterior", subseccion: "Componentes", etiqueta: "Gato", orden: 60 },
  { id: "ext_herramientas", seccion: "parte_trasera_exterior", subseccion: "Componentes", etiqueta: "Herramientas", orden: 70 },
  { id: "ext_triangulo", seccion: "parte_trasera_exterior", subseccion: "Componentes", etiqueta: "Triángulo", orden: 80 },
  { id: "ext_antena", seccion: "parte_trasera_exterior", subseccion: "Componentes", etiqueta: "Antena", orden: 90 },
  { id: "ext_guardafango_tras_rh", seccion: "parte_trasera_exterior", subseccion: "Estado", etiqueta: "Guardafango trasero RH", orden: 100 },
  { id: "ext_guardafango_tras_lh", seccion: "parte_trasera_exterior", subseccion: "Estado", etiqueta: "Guardafango trasero LH", orden: 110 },
  { id: "ext_radio_am_fm_cd", seccion: "parte_trasera_exterior", subseccion: "Estado", etiqueta: "Sistema de radio AM/FM/CD", orden: 120 },
];

export function checklistPorSeccion(seccion: ChecklistCatalogItem["seccion"]) {
  return RECEPCION_CHECKLIST_CATALOG.filter((i) => i.seccion === seccion).sort(
    (a, b) => a.orden - b.orden
  );
}
