/** Campos de formulario rellenables por OCR (factura / BL / certificado). */
export type PuertoLibreRegistroScanFields = {
  marca?: string;
  modelo?: string;
  color?: string;
  anio?: string;
  serialMotor?: string;
  vin?: string;
  serialCarroceria?: string;
  kilometraje?: string;
  condicion?: "nuevo" | "usado";
  esSubasta?: "true" | "false";
  partidaArancelaria?: string;
  cilindradaCc?: string;
  tipoCombustible?:
    | "gasolina"
    | "diesel"
    | "electrico"
    | "hibrido"
    | "gnv"
    | "otro";
  fechaLlegadaBuque?: string;
  importadorNombre?: string;
  importadorDocumento?: string;
  importadorTelefono?: string;
  importadorEmail?: string;
  importadorDireccion?: string;
  /** Puerto de descarga / llegada (distinto de la aduana SENIAT). */
  puerto?: string;
  /** ninguno | transito | uso24 */
  modalidadTransito?: "ninguno" | "transito" | "uso24";
  aduanaTransito?: string;
  aduana?: string;
  numeroBl?: string;
  paisOrigen?: string;
  valorCif?: string;
  tasaCambioBcv?: string;
  costosArancelariosUsd?: string;
  gastosPuertoUsd?: string;
  fleteInternacionalUsd?: string;
  costoTotalLandedUsd?: string;
  numeroExpedienteSeniat?: string;
  numeroDav?: string;
  numeroCertificadoOrigen?: string;
  numeroListaEmpaque?: string;
  numeroPolizaTransporte?: string;
  observaciones?: string;
};
