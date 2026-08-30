import { parseCertEngineNosFromText } from "../lib/importacion/cert-engine-text";

const SAMPLE = `
CERTIFICATE OF ORIGIN PAGE 1
VIN LVVDB21B9VE033523 TIGGO 2 PRO MAX
VIN LVVDB21B1VE033189

PAGE 2
ENGINE NO SQRE4T15C2408123
LVVDB21B9VE033523 ENGINE NO SQRE4T15C2408123
LVVDB21B1VE033189 ENGINE NO SQRE4T15C2408456
`;

const pairs = parseCertEngineNosFromText(SAMPLE);
if (pairs.length < 2) {
  console.error("esperado ≥2 pares", pairs);
  process.exit(1);
}
const byVin = Object.fromEntries(pairs.map((p) => [p.vin, p.serialMotor]));
if (byVin.LVVDB21B9VE033523 !== "SQRE4T15C2408123") {
  console.error("motor 1", byVin);
  process.exit(1);
}
if (byVin.LVVDB21B1VE033189 !== "SQRE4T15C2408456") {
  console.error("motor 2", byVin);
  process.exit(1);
}
console.log("ok", pairs);
