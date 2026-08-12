# Instructivo: cómo llenar una importación (SmartTaller)

Guía operativa de la planilla de importación vehicular (Puerto Libre / SENIAT).

**Ruta en la app:** [/importacion/instructivo](/importacion/instructivo)  
**Dashboard:** [/importacion](/importacion)

Flujo: **Registro → Embarque → Llegada → Desaduanamiento → Propietario → Seguro → Matriculación**.

---

## Antes de empezar

1. Entra al módulo **Importación**.
2. Si el cliente no existe: **Clientes** → créalo (RIF/cédula, dirección fiscal, etc.).
3. Elige el cliente e inicia **Registrar importación** (o **Carga masiva** si traes varias facturas).

Cada unidad genera un expediente interno tipo `PL-2026.8.1` (distinto del número que asigne SENIAT).

---

## Fase 1 — Registro

### A. Datos del vehículo

| Campo | Qué poner |
|--------|-----------|
| Marca / modelo / color / año | Del catálogo o factura |
| Serial motor | Obligatorio |
| VIN | VIN internacional (17 caracteres) |
| Serial carrocería | Dato SENIAT; a veces ≠ VIN. Único por taller |
| Condición | **Nuevo** → km suele ser 0. **Usado** → km > 0 e indicar si es de subasta |
| Cilindrada / combustible | Si los tienes |
| Partida arancelaria | Opcional |

### B. Importador

- Cliente ya elegido (nombre, RIF, teléfono, email).
- **Dirección fiscal** clara (para SENIAT / Nueva Esparta cuando aplique).

### C. Datos de importación (en este orden)

1. **Régimen** (ej. Puerto Libre)
2. **Aduana**
3. **País de origen**
4. **Puerto**
5. **Tránsito o USO24** (si no aplica → “Sin tránsito / USO24”)
6. **Aduana de tránsito** (solo si hay tránsito o USO24)
7. **Nº BL / Guía**
8. **Fecha de llegada del buque**

Luego, si los tienes: CIF, tasa BCV, Nº expediente SENIAT, DAV, certificado de origen, lista de empaque, póliza de transporte, observaciones.

### D. Documentos obligatorios

- Factura de compra
- Certificado de origen

(Puedes escanear/OCR para autorellenar.)

**Continuar a Embarque** cuando datos + docs estén listos.

---

## Fase 2 — Embarque

Carga estos 4 documentos:

1. BL / Guía
2. Lista de embarque / empaque
3. DAV
4. Póliza de transporte

**Continuar a Llegada.**

---

## Fase 3 — Llegada

1. **Fecha de ingreso al PL** (ingreso aduanero; no es la misma que la llegada del buque).
2. Documentos:
   - **Acta de recepción de mercancía (AR)**
   - **Constancia EDI de la carga (Reconocimiento)**
3. **Memoria fotográfica** (frontal, trasera, laterales, motor, impronta, odómetro, etc.).
4. **Foto de impronta**: el sistema verifica el serial. Debe coincidir con el del expediente. Si OCR no lee y eres operador, puedes confirmar revisión manual; si **no coincide**, corrige serial o vuelve a fotografiar.
5. **Checklist** (cristales, llantas, luces, llaves, GPS, alarma, etc.) y notas de daño si aplica.

**Continuar a Desaduanamiento.**

---

## Fase 4 — Desaduanamiento (Expediente SENIAT)

1. Indica el **Agente de Aduanas** (nombre).
2. Completa la carpeta (algunos docs ya vienen de Embarque/Llegada):

| # | Documento |
|---|-----------|
| 1 | Cédula del importador |
| 2 | RIF del importador (dir. Nueva Esparta, Venezuela) |
| 3 | Lista de embarque / empaque |
| 4 | DUA |
| 5 | DAV |
| 6 | SENCAMER |
| 7 | Registro de Puerto Libre |
| 8 | Agente aduanal (documento) |
| 9 | Reconocimiento (EDI, desde Llegada) |
| 10 | Pase de salida y levante |
| 11 | Cancelación de gastos portuarios |
| 12 | Nota del levante (SENIAT) |

Según el régimen pueden pedirse extras (ej. constancia de residencia en Puerto Libre).

3. Descarga el **Expediente PDF SENIAT** para imprimir / consignar.
4. **Continuar a Propietario** cuando la carpeta esté completa.

---

## Fase 5 — Propietario

Nombre (obligatorio), cédula, teléfono, email y dirección del comprador/propietario.

**Continuar a Seguro.**

---

## Fase 6 — Seguro del vehículo

- Aseguradora (obligatoria).
- Docs: póliza, certificado, recibo, RCV.

*(No confundir con la póliza de **transporte** del embarque.)*

**Continuar a Matriculación.**

---

## Fase 7 — Matriculación (trámite INTT)

1. **Cargar:** inspección PNB, homologación (si el vehículo lo requiere), PUT y planilla de pago.
2. **Presentar en físico:** factura, B/L, DUA, liquidación/exención, experticia, póliza RCV, cédula, RIF y constancia de residencia (verifica que estén en el expediente).
3. **Entrega:** carga el **título** y registra las **placas PL**.

Al cerrar: planilla completa (`fase 8`) y, en Puerto Libre, suele fijarse la **fecha límite de nacionalización** (≈ 3 años desde ingreso).

---

## Después de la planilla (Puerto Libre)

En `/importacion/[id]/nacionalizar`:

- **M2 (cambio de régimen)** si aún no cumplen 3 años.
- **M3 (permanencia)** si ya cumplieron 3 años.

Sigue el wizard de docs y liquidación hasta marcar nacionalizado.

---

## Tips rápidos (accionables)

| Tip | Cómo usarlo |
|-----|-------------|
| **Guarda avance por fase** | Cada “Continuar” persiste. En la planilla, toca el chip de una fase anterior para revisar o corregir sin perder el progreso. |
| **VIN ≠ serial carrocería** | Ambos son obligatorios en Registro. El VIN es internacional; el serial carrocería es el dato SENIAT y se verifica en la impronta. |
| **Formato RIF** | Usa `V\|J\|E\|G\|P\|C-########-#` (ej. `V-12345678-9`). Persona natural (V/E): cupo máx. 1 vehículo en menos de 3 años. |
| **Carga masiva** | Si tienes muchas facturas, usa [/importacion/carga-masiva](/importacion/carga-masiva) o el acceso desde “Nueva importación”. Comparte aduana, BL y fecha de llegada. |
| **Dashboard por estado** | En [/importacion](/importacion) los buckets te llevan directo a la fase pendiente (registro, embarque, recibir en puerto, SENIAT, nacionalizar, etc.). |

---

*Documento vivo del módulo Importación. Contexto técnico: `docs/PUERTO-LIBRE-CONTEXT.md`.*
