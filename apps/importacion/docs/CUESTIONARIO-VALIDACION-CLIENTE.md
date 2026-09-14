# Cuestionario de validación — Expediente digital Puerto Libre (SmartImport)

**Objetivo:** Confirmar con el cliente que los **datos** y **documentos** solicitados en cada fase del flujo son correctos, completos y alineados a su operación real. También recoger **funciones adicionales** que deseen incorporar.

| Campo | Valor |
|-------|--------|
| Cliente / empresa | _______________________________ |
| Persona de contacto | _______________________________ |
| Cargo | _______________________________ |
| Correo / teléfono | _______________________________ |
| Fecha de revisión | ____ / ____ / ________ |
| Facilitador (nuestro lado) | _______________________________ |
| Versión del flujo revisado | Planilla rev. 2 (10 fases + nacionalización) |

**Cómo responder**

- Marque **Sí / No / Parcial** según corresponda.
- En “Observaciones” indique qué quitar, agregar, renombrar o hacer opcional/obligatorio.
- Al final priorice las funciones extras (Alta / Media / Baja).

---

## A. Alcance general del producto

| # | Pregunta | Sí | No | Parcial | Observaciones |
|---|----------|----|----|---------|---------------|
| A1 | ¿El flujo debe cubrir desde el **alta del importador** hasta **placa / circulación**? | ☐ | ☐ | ☐ | |
| A2 | ¿Deben soportarse estos regímenes: **ordinario, equipaje, puerto libre, diplomático, temporal**? | ☐ | ☐ | ☐ | |
| A3 | ¿La **nacionalización** (cambio de régimen &lt; 3 años / permanencia ≥ 3 años) aplica solo a Puerto Libre? | ☐ | ☐ | ☐ | |
| A4 | ¿El código interno de expediente tipo `PL-{año}.{mes}.{N}` es adecuado (distinto del expediente SENIAT)? | ☐ | ☐ | ☐ | |
| A5 | ¿Necesitan **carga masiva** (CSV/Excel/OCR) además del alta unitaria? | ☐ | ☐ | ☐ | |
| A6 | ¿Los roles actuales (master, admin, aduanera, taller, concesionario, usuario) cubren su organización? | ☐ | ☐ | ☐ | ¿Faltan roles? ________ |

---

## B. Pre-planilla — Cliente importador

Antes de abrir un expediente se crea o selecciona el **importador**.

### B.1 Datos del importador

| Dato solicitado | ¿Es correcto? | ¿Obligatorio? | Observaciones / campo a agregar o quitar |
|-----------------|---------------|---------------|------------------------------------------|
| Tipo: persona natural / jurídica | ☐ Sí ☐ No ☐ Parcial | ☐ Sí ☐ No | |
| Nombre o razón social | ☐ Sí ☐ No ☐ Parcial | ☐ Sí ☐ No | |
| Documento de identidad / RIF | ☐ Sí ☐ No ☐ Parcial | ☐ Sí ☐ No | |
| Teléfono | ☐ Sí ☐ No ☐ Parcial | ☐ Sí ☐ No | |
| Correo | ☐ Sí ☐ No ☐ Parcial | ☐ Sí ☐ No | |
| Dirección fiscal | ☐ Sí ☐ No ☐ Parcial | ☐ Sí ☐ No | |

### B.2 Documentos del importador (se reutilizan en Embarque / SENIAT)

| Documento | ¿Correcto en catálogo? | ¿Obligatorio? | Observaciones |
|-----------|------------------------|---------------|---------------|
| RIF vigente | ☐ Sí ☐ No ☐ Parcial | ☐ Sí ☐ No | |
| Cédula o pasaporte (laminado y vigente) | ☐ Sí ☐ No ☐ Parcial | ☐ Sí ☐ No | |
| Constancia de domicilio | ☐ Sí ☐ No ☐ Parcial | ☐ Sí ☐ No | |
| Comprobante de inscripción tributaria | ☐ Sí ☐ No ☐ Parcial | ☐ Sí ☐ No | |
| Acta constitutiva *(solo jurídica)* | ☐ Sí ☐ No ☐ Parcial | ☐ Sí ☐ No | |

**B3.** ¿Falta algún recaudo del importador que su operación exija siempre?  
_______________________________________________________________________________

---

## C. Fase 1 — Registro

### C.1 Datos del vehículo y de la operación

| Dato | ¿Correcto? | ¿Obligatorio? | Observaciones |
|------|------------|---------------|---------------|
| Marca | ☐ Sí ☐ No ☐ Parcial | ☐ Sí ☐ No | |
| Modelo | ☐ Sí ☐ No ☐ Parcial | ☐ Sí ☐ No | |
| Color | ☐ Sí ☐ No ☐ Parcial | ☐ Sí ☐ No | |
| Año | ☐ Sí ☐ No ☐ Parcial | ☐ Sí ☐ No | |
| Serial del motor | ☐ Sí ☐ No ☐ Parcial | ☐ Sí ☐ No | |
| VIN | ☐ Sí ☐ No ☐ Parcial | ☐ Sí ☐ No | |
| Serial de carrocería | ☐ Sí ☐ No ☐ Parcial | ☐ Sí ☐ No | |
| Kilometraje | ☐ Sí ☐ No ☐ Parcial | ☐ Sí ☐ No | |
| Condición (nuevo / usado) + subasta | ☐ Sí ☐ No ☐ Parcial | ☐ Sí ☐ No | |
| Cilindrada (cc) | ☐ Sí ☐ No ☐ Parcial | ☐ Sí ☐ No | |
| Combustible (gasolina, diésel, eléctrico, híbrido, GNV, otro) | ☐ Sí ☐ No ☐ Parcial | ☐ Sí ☐ No | |
| Partida arancelaria *(opcional en esta fase)* | ☐ Sí ☐ No ☐ Parcial | ☐ Sí ☐ No | ¿Mover a Llegada? ____ |
| Régimen de importación | ☐ Sí ☐ No ☐ Parcial | ☐ Sí ☐ No | |
| Aduana / puerto / tránsito (USO24) | ☐ Sí ☐ No ☐ Parcial | ☐ Sí ☐ No | |
| Número de BL | ☐ Sí ☐ No ☐ Parcial | ☐ Sí ☐ No | |
| Fechas relevantes (embarque / referencia) | ☐ Sí ☐ No ☐ Parcial | ☐ Sí ☐ No | |
| Valor CIF | ☐ Sí ☐ No ☐ Parcial | ☐ Sí ☐ No | |
| Tasa BCV | ☐ Sí ☐ No ☐ Parcial | ☐ Sí ☐ No | |
| Snapshot del importador (nombre, documento, dirección) | ☐ Sí ☐ No ☐ Parcial | ☐ Sí ☐ No | |

### C.2 Documentos

| Documento | ¿Correcto? | ¿Obligatorio para avanzar? | Observaciones |
|-----------|------------|----------------------------|---------------|
| Factura de compra / comercial | ☐ Sí ☐ No ☐ Parcial | ☐ Sí ☐ No | |
| Certificado de origen | ☐ Sí ☐ No ☐ Parcial | ☐ Sí ☐ No | |

**C3.** ¿Deben poder cargarse factura y certificado juntos (mismo lote)? ☐ Sí ☐ No  
**C4.** ¿El OCR sobre factura/certificado es útil para ustedes? ☐ Sí ☐ No ☐ No aplica  
**C5.** Datos o documentos a **agregar / quitar** en Registro:  
_______________________________________________________________________________

---

## D. Fase 2 — Embarque

### D.1 Datos

| Dato | ¿Correcto? | ¿Obligatorio? | Observaciones |
|------|------------|---------------|---------------|
| Régimen | ☐ Sí ☐ No ☐ Parcial | ☐ Sí ☐ No | |
| Nº certificado de origen | ☐ Sí ☐ No ☐ Parcial | ☐ Sí ☐ No | |
| Observaciones | ☐ Sí ☐ No ☐ Parcial | ☐ Sí ☐ No | |
| Fecha de llegada del buque | ☐ Sí ☐ No ☐ Parcial | ☐ Sí ☐ No | |
| Puerto | ☐ Sí ☐ No ☐ Parcial | ☐ Sí ☐ No | |
| Tránsito / USO24 | ☐ Sí ☐ No ☐ Parcial | ☐ Sí ☐ No | |
| Aduana | ☐ Sí ☐ No ☐ Parcial | ☐ Sí ☐ No | |
| Número de BL | ☐ Sí ☐ No ☐ Parcial | ☐ Sí ☐ No | |
| País de origen | ☐ Sí ☐ No ☐ Parcial | ☐ Sí ☐ No | |

### D.2 Documentos de carga

| Documento | ¿Correcto? | ¿Obligatorio hoy? | ¿Debería ser obligatorio? | Observaciones |
|-----------|------------|-------------------|---------------------------|---------------|
| BL / Guía (Bill of Lading) | ☐ Sí ☐ No ☐ Parcial | Sí | ☐ Sí ☐ No | |
| Lista de empaque | ☐ Sí ☐ No ☐ Parcial | Sí | ☐ Sí ☐ No | |
| Póliza de transporte | ☐ Sí ☐ No ☐ Parcial | No (opcional) | ☐ Sí ☐ No | |

### D.3 Documentos del importador en esta fase

Se exigen: RIF, cédula/pasaporte, constancia de domicilio, comprobante de inscripción tributaria (+ acta constitutiva si es jurídica).

| Pregunta | Sí | No | Parcial | Observaciones |
|----------|----|----|---------|---------------|
| ¿Es correcto exigirlos aquí (y no solo en SENIAT)? | ☐ | ☐ | ☐ | |
| ¿Prefieren exigirlos solo al crear el cliente? | ☐ | ☐ | ☐ | |

**D4.** ¿Copiar documentos entre unidades del **mismo BL** (lote) es correcto para su operación? ☐ Sí ☐ No  
**D5.** Ajustes en Embarque:  
_______________________________________________________________________________

---

## E. Fase 3 — Llegada

### E.1 Datos

| Dato | ¿Correcto? | ¿Obligatorio? | Observaciones |
|------|------------|---------------|---------------|
| Fecha de ingreso *(distinta de llegada del buque)* | ☐ Sí ☐ No ☐ Parcial | ☐ Sí ☐ No | |
| Partida arancelaria | ☐ Sí ☐ No ☐ Parcial | ☐ Sí ☐ No | |

> **Nota de diseño actual:** la revisión fotográfica y el checklist físico se completan en la **Fase 6 — Inspección** (no en Llegada).

| Pregunta | Sí | No | Parcial | Observaciones |
|----------|----|----|---------|---------------|
| ¿Está de acuerdo en dejar fotos y checklist en Inspección? | ☐ | ☐ | ☐ | |
| ¿Prefiere que vuelvan a Llegada? | ☐ | ☐ | ☐ | |

**E2.** Ajustes en Llegada:  
_______________________________________________________________________________

---

## F. Fase 4 — Desaduanamiento (Expediente SENIAT)

### F.1 Datos

| Dato | ¿Correcto? | ¿Obligatorio? | Observaciones |
|------|------------|---------------|---------------|
| Agente aduanal | ☐ Sí ☐ No ☐ Parcial | ☐ Sí ☐ No | |
| Nº expediente SENIAT *(si aplica)* | ☐ Sí ☐ No ☐ Parcial | ☐ Sí ☐ No | |
| Nº DAV *(si aplica)* | ☐ Sí ☐ No ☐ Parcial | ☐ Sí ☐ No | |

### F.2 Carpeta a presentar (base)

| Documento | ¿Debe ir en el expediente SENIAT? | ¿Obligatorio? | Observaciones |
|-----------|-----------------------------------|---------------|---------------|
| Factura comercial | ☐ Sí ☐ No ☐ Parcial | ☐ Sí ☐ No | Precargada |
| Certificado de origen | ☐ Sí ☐ No ☐ Parcial | ☐ Sí ☐ No | Precargado |
| BL / Guía | ☐ Sí ☐ No ☐ Parcial | ☐ Sí ☐ No | Precargado |
| Lista de empaque | ☐ Sí ☐ No ☐ Parcial | ☐ Sí ☐ No | Precargada |
| Póliza de transporte | ☐ Sí ☐ No ☐ Parcial | ☐ Sí ☐ No | Precargada si existe |
| Cédula / pasaporte del importador | ☐ Sí ☐ No ☐ Parcial | ☐ Sí ☐ No | |
| RIF del importador | ☐ Sí ☐ No ☐ Parcial | ☐ Sí ☐ No | |
| DUA (Declaración Única de Aduanas) | ☐ Sí ☐ No ☐ Parcial | ☐ Sí ☐ No | Carga el agente |
| DAV (Declaración Andina de Valor) | ☐ Sí ☐ No ☐ Parcial | ☐ Sí ☐ No | |

### F.3 Documentos extra según régimen

| Régimen | Documento(s) extra | ¿Correcto? | Observaciones |
|---------|--------------------|------------|---------------|
| Ordinario | Licencia de importación automotriz | ☐ Sí ☐ No ☐ Parcial | |
| Equipaje | Certificado de uso consular, oficio de exoneración SENIAT, pasaporte del propietario, declaración jurada del propietario | ☐ Sí ☐ No ☐ Parcial | |
| Diplomático | Franquicia / facilidad diplomática | ☐ Sí ☐ No ☐ Parcial | |
| Temporal | Autorización de admisión temporal | ☐ Sí ☐ No ☐ Parcial | |
| Puerto libre | *(sin extras de carpeta base)* | ☐ Sí ☐ No ☐ Parcial | |

### F.4 Documentos reservados (fuera de esta fase hoy)

Hoy **no** se exigen aquí: SENCAMER, registro Puerto Libre, constancia del agente, EDI, liquidación, constancia de residencia. El **pase de salida** se carga en Pago impuesto.

| Pregunta | Sí | No | Parcial | Observaciones |
|----------|----|----|---------|---------------|
| ¿Alguno de estos debe entrar en Desaduanamiento? | ☐ | ☐ | ☐ | ¿Cuáles? ________ |
| ¿El PDF de expediente SENIAT generado por el sistema les sirve? | ☐ | ☐ | ☐ | |

**F5.** Ajustes en Desaduanamiento:  
_______________________________________________________________________________

---

## G. Fase 5 — Pago de impuesto

### G.1 Documentos (orden actual)

| Documento | ¿Correcto? | ¿Obligatorio? | Observaciones |
|-----------|------------|---------------|---------------|
| Planilla / liquidación de tributos (comprobante SENIAT) | ☐ Sí ☐ No ☐ Parcial | ☐ Sí ☐ No | |
| Pase de salida / levante | ☐ Sí ☐ No ☐ Parcial | ☐ Sí ☐ No | No va al PDF SENIAT |
| Constancia de nacionalización *(autoriza retiro del puerto)* | ☐ Sí ☐ No ☐ Parcial | ☐ Sí ☐ No | |

### G.2 Datos económicos

| Dato / función | ¿Correcto? | Observaciones |
|----------------|------------|---------------|
| Precálculo / registro de aranceles (CIF, USD/Bs) | ☐ Sí ☐ No ☐ Parcial | |
| ¿Necesitan cálculo automático de tributos? | ☐ Sí ☐ No ☐ N/A | |

**G3.** ¿Falta algún comprobante de pago o gasto portuario (p. ej. cancelación de gastos portuarios, nota de levante)?  
_______________________________________________________________________________

---

## H. Fase 6 — Inspección

### H.1 Documentos

| Documento | ¿Correcto? | ¿Obligatorio? | Observaciones |
|-----------|------------|---------------|---------------|
| Acta de recepción de mercancía (AR) | ☐ Sí ☐ No ☐ Parcial | ☐ Sí ☐ No | |
| Constancia EDI / reconocimiento | ☐ Sí ☐ No ☐ Parcial | ☐ Sí ☐ No | |
| Constancia de inspección | ☐ Sí ☐ No ☐ Parcial | ☐ Sí ☐ No | |
| Revisión del vehículo (PDF) | ☐ Sí ☐ No ☐ Parcial | ☐ Sí ☐ No | |

### H.2 Memoria fotográfica

| Foto | ¿Debe pedirse? | ¿Obligatoria? | Observaciones |
|------|----------------|---------------|---------------|
| Frontal | ☐ Sí ☐ No | ☐ Sí ☐ No | |
| Trasera | ☐ Sí ☐ No | ☐ Sí ☐ No | |
| Lateral izquierdo | ☐ Sí ☐ No | ☐ Sí ☐ No | |
| Lateral derecho | ☐ Sí ☐ No | ☐ Sí ☐ No | |
| Motor | ☐ Sí ☐ No | ☐ Sí ☐ No | |
| Odómetro | ☐ Sí ☐ No | ☐ Sí ☐ No | |
| Impronta *(hoy opcional; si hay, se cruza con serial)* | ☐ Sí ☐ No | ☐ Sí ☐ No | |
| Otras (daños, VIN, placa, comprador…) | ☐ Sí ☐ No | ☐ Sí ☐ No | ¿Cuáles? ____ |

### H.3 Checklist físico (14 ítems)

Para cada ítem: ¿mantener? ¿obligatorio? Respuestas actuales: OK / Daño / N/A.

| Ítem | ¿Mantener? | ¿Obligatorio? | Observaciones |
|------|------------|---------------|---------------|
| Cristales / parabrisas | ☐ Sí ☐ No | ☐ Sí ☐ No | |
| Llantas y rines | ☐ Sí ☐ No | ☐ Sí ☐ No | |
| Luces exteriores | ☐ Sí ☐ No | ☐ Sí ☐ No | |
| Sin fuga visible de fluidos | ☐ Sí ☐ No | ☐ Sí ☐ No | |
| Llaves | ☐ Sí ☐ No | ☐ Sí ☐ No | |
| Controles | ☐ Sí ☐ No | ☐ Sí ☐ No | |
| Manuales | ☐ Sí ☐ No | ☐ Sí ☐ No | |
| Rueda de repuesto | ☐ Sí ☐ No | ☐ Sí ☐ No | |
| Gato | ☐ Sí ☐ No | ☐ Sí ☐ No | |
| Triángulo de seguridad | ☐ Sí ☐ No | ☐ Sí ☐ No | |
| Documentos del vehículo en carpeta | ☐ Sí ☐ No | ☐ Sí ☐ No | |
| Alarma | ☐ Sí ☐ No | ☐ Sí ☐ No | |
| GPS / rastreador | ☐ Sí ☐ No | ☐ Sí ☐ No | |
| Inmovilizador | ☐ Sí ☐ No | ☐ Sí ☐ No | |

**H4.** Ítems a **agregar** al checklist:  
_______________________________________________________________________________

**H5.** Ajustes en Inspección:  
_______________________________________________________________________________

---

## I. Fase 7 — Propietario

| Dato | ¿Correcto? | ¿Obligatorio? | Observaciones |
|------|------------|---------------|---------------|
| Nombre | ☐ Sí ☐ No ☐ Parcial | ☐ Sí ☐ No | Hoy obligatorio |
| Cédula | ☐ Sí ☐ No ☐ Parcial | ☐ Sí ☐ No | |
| Teléfono | ☐ Sí ☐ No ☐ Parcial | ☐ Sí ☐ No | |
| Correo | ☐ Sí ☐ No ☐ Parcial | ☐ Sí ☐ No | |
| Dirección | ☐ Sí ☐ No ☐ Parcial | ☐ Sí ☐ No | |
| Fecha de nacimiento | ☐ Sí ☐ No ☐ Parcial | ☐ Sí ☐ No | Hoy opcional |

**I2.** ¿El propietario puede ser distinto del importador? ☐ Sí ☐ No  
**I3.** ¿Necesitan documento de identidad del propietario como archivo en esta fase? ☐ Sí ☐ No  
**I4.** Ajustes:  
_______________________________________________________________________________

---

## J. Fase 8 — Seguro del vehículo

> Distinto de la **póliza de transporte** del embarque.

### J.1 Datos

| Dato | ¿Correcto? | ¿Obligatorio? | Observaciones |
|------|------------|---------------|---------------|
| Aseguradora | ☐ Sí ☐ No ☐ Parcial | ☐ Sí ☐ No | Hoy obligatoria |
| Vigencia | ☐ Sí ☐ No ☐ Parcial | ☐ Sí ☐ No | |
| Cobertura / otros campos del seguro | ☐ Sí ☐ No ☐ Parcial | ☐ Sí ☐ No | ¿Cuáles faltan? ____ |

### J.2 Documentos

| Documento | ¿Correcto? | ¿Obligatorio? | Observaciones |
|-----------|------------|---------------|---------------|
| Póliza de seguro | ☐ Sí ☐ No ☐ Parcial | ☐ Sí ☐ No | |
| Certificado de seguro | ☐ Sí ☐ No ☐ Parcial | ☐ Sí ☐ No | |
| Recibo de seguro | ☐ Sí ☐ No ☐ Parcial | ☐ Sí ☐ No | |
| RCV | ☐ Sí ☐ No ☐ Parcial | ☐ Sí ☐ No | Se reutiliza en placa |

**J3.** Ajustes en Seguro:  
_______________________________________________________________________________

---

## K. Fase 9 — Matriculación INTT

### K.1 Carpeta de presentación (~9 recaudos)

| Documento | ¿Correcto? | ¿Obligatorio? | Observaciones |
|-----------|------------|---------------|---------------|
| Cédula de identidad vigente | ☐ Sí ☐ No ☐ Parcial | ☐ Sí ☐ No | Precargada |
| RIF vigente | ☐ Sí ☐ No ☐ Parcial | ☐ Sí ☐ No | Precargado |
| Factura original de compra | ☐ Sí ☐ No ☐ Parcial | ☐ Sí ☐ No | Precargada |
| Certificado de origen | ☐ Sí ☐ No ☐ Parcial | ☐ Sí ☐ No | Precargado |
| Constancia de homologación *(si aplica)* | ☐ Sí ☐ No ☐ Parcial | ☐ Sí ☐ No | Condicional |
| Liquidación de tributos SENIAT | ☐ Sí ☐ No ☐ Parcial | ☐ Sí ☐ No | Precargada |
| Constancia de inspección del puerto | ☐ Sí ☐ No ☐ Parcial | ☐ Sí ☐ No | Precargada |
| Declaración de propiedad | ☐ Sí ☐ No ☐ Parcial | ☐ Sí ☐ No | |
| Comprobante de pago de tasas INTT | ☐ Sí ☐ No ☐ Parcial | ☐ Sí ☐ No | |

| Pregunta | Sí | No | Parcial | Observaciones |
|----------|----|----|---------|---------------|
| ¿El PDF de archivo INTT generado les sirve? | ☐ | ☐ | ☐ | |
| ¿Deben incluirse inspección PNB o planilla SUMICA/PUT? | ☐ | ☐ | ☐ | |

**K2.** Ajustes en Matrícula:  
_______________________________________________________________________________

---

## L. Fase 10 — Placa y circulación

| Dato / documento | ¿Correcto? | ¿Obligatorio? | Observaciones |
|------------------|------------|---------------|---------------|
| Número de placa real *(reemplaza `NP-…`)* | ☐ Sí ☐ No ☐ Parcial | ☐ Sí ☐ No | |
| Documento de circulación | ☐ Sí ☐ No ☐ Parcial | ☐ Sí ☐ No | |
| PDF de la placa | ☐ Sí ☐ No ☐ Parcial | ☐ Sí ☐ No | |
| Título de propiedad | ☐ Sí ☐ No ☐ Parcial | ☐ Sí ☐ No | |
| RCV *(desde Seguro)* | ☐ Sí ☐ No ☐ Parcial | ☐ Sí ☐ No | |
| Tarjeta de circulación | ☐ Sí ☐ No ☐ Parcial | ☐ Sí ☐ No | |

**L2.** Al completar esta fase el sistema marca la planilla **completa** y, en Puerto Libre, calcula `fechaLimiteNacionalizacion` ≈ ingreso + 3 años. ¿Es correcto? ☐ Sí ☐ No ☐ Parcial  

**L3.** Ajustes:  
_______________________________________________________________________________

---

## M. Post-planilla — Nacionalización (régimen Puerto Libre)

Wizard: **Vía → Documentos → Cierre**.

### M.1 Vías

| Vía | Condición | ¿Correcta? | Observaciones |
|-----|-----------|------------|---------------|
| M2 — Cambio de régimen | &lt; 3 años desde ingreso | ☐ Sí ☐ No ☐ Parcial | |
| M3 — Permanencia | ≥ 3 años | ☐ Sí ☐ No ☐ Parcial | |

### M.2 Base reutilizada del expediente

Factura, certificado de origen, DUA, RCV. ¿Correcto? ☐ Sí ☐ No ☐ Parcial — Obs.: ________

### M.3 Documentos nuevos

| Documento | M2 | M3 | ¿Correcto? | ¿Obligatorio? | Observaciones |
|-----------|----|----|------------|---------------|---------------|
| Declaración complementaria | Sí | No | ☐ Sí ☐ No ☐ Parcial | ☐ Sí ☐ No | |
| Constancia de residencia / permanencia | Sí | Sí | ☐ Sí ☐ No ☐ Parcial | ☐ Sí ☐ No | |
| Liquidación de nacionalización | Sí | Sí | ☐ Sí ☐ No ☐ Parcial | ☐ Sí ☐ No | |
| Resolución de liberación SENIAT | Sí | Sí | ☐ Sí ☐ No ☐ Parcial | ☐ Sí ☐ No | |
| Solicitud de levantamiento INTT | Sí | Sí | ☐ Sí ☐ No ☐ Parcial | ☐ Sí ☐ No | |
| Título de libre circulación | Sí | Sí | ☐ Sí ☐ No ☐ Parcial | ☐ Sí ☐ No | |

| Pregunta | Sí | No | Parcial | Observaciones |
|----------|----|----|---------|---------------|
| ¿Alertas por vencimiento del plazo de 3 años son útiles? | ☐ | ☐ | ☐ | |
| ¿Cupo persona natural (1 vehículo / &lt; 3 años) debe validarse en sistema? | ☐ | ☐ | ☐ | |

**M4.** Ajustes en Nacionalización:  
_______________________________________________________________________________

---

## N. Funciones actuales — ¿mantener / mejorar?

Valore cada capacidad ya existente (1 = no necesaria, 5 = crítica).

| Función | 1–5 | ¿Mejorar? | Comentario breve |
|---------|-----|-----------|------------------|
| Dashboard por colas (embarque, llegada, SENIAT, rechazos, nacionalizar…) | __ | ☐ | |
| Clientes importadores + docs con OCR | __ | ☐ | |
| Planilla por fases | __ | ☐ | |
| Carga masiva CSV / Excel / OCR | __ | ☐ | |
| Expedientes PDF (general, SENIAT, INTT) | __ | ☐ | |
| Stickers NFC públicos `/v/{token}` + PIN | __ | ☐ | |
| Inspección transportista | __ | ☐ | |
| Biblioteca legal / normas | __ | ☐ | |
| Validación de cupo persona natural | __ | ☐ | |
| Alertas email de vencimiento (cron) | __ | ☐ | |
| Plazos aduaneros / presentaciones anuales | __ | ☐ | |
| Lotes por BL (copiar docs entre unidades) | __ | ☐ | |
| Roles de portal | __ | ☐ | |

---

## O. Funciones adicionales solicitadas

Indique si desea cada función y su prioridad (**A** = esta entrega / **M** = siguiente / **B** = backlog).

| # | Función propuesta | ¿La quiere? | Prioridad | Notas / detalle |
|---|-------------------|-------------|-----------|-----------------|
| O1 | Agenda / citas SENIAT (fecha, recordatorio, estado “agendada” automático) | ☐ Sí ☐ No | ☐ A ☐ M ☐ B | |
| O2 | Cálculo automático de aranceles e impuestos | ☐ Sí ☐ No | ☐ A ☐ M ☐ B | |
| O3 | Notificaciones WhatsApp / SMS (además de email) | ☐ Sí ☐ No | ☐ A ☐ M ☐ B | |
| O4 | Firma digital / acuse de documentos | ☐ Sí ☐ No | ☐ A ☐ M ☐ B | |
| O5 | Portal del importador (ver su expediente sin rol interno) | ☐ Sí ☐ No | ☐ A ☐ M ☐ B | |
| O6 | App móvil / PWA para inspección en patio | ☐ Sí ☐ No | ☐ A ☐ M ☐ B | |
| O7 | Integración con sistemas SENIAT / INTT (si existe API o canal) | ☐ Sí ☐ No | ☐ A ☐ M ☐ B | |
| O8 | Multi-sede / multi-aduana con permisos separados | ☐ Sí ☐ No | ☐ A ☐ M ☐ B | |
| O9 | Reportes y exportación contable / gerencial | ☐ Sí ☐ No | ☐ A ☐ M ☐ B | |
| O10 | Facturación / cobro de honorarios por expediente | ☐ Sí ☐ No | ☐ A ☐ M ☐ B | |
| O11 | Chat o soporte interno por expediente | ☐ Sí ☐ No | ☐ A ☐ M ☐ B | |
| O12 | Plantillas de correo al cliente (estado del trámite) | ☐ Sí ☐ No | ☐ A ☐ M ☐ B | |
| O13 | Historial de auditoría (quién cargó / cambió cada doc) | ☐ Sí ☐ No | ☐ A ☐ M ☐ B | |
| O14 | Validación OCR reforzada (VIN, seriales, montos) | ☐ Sí ☐ No | ☐ A ☐ M ☐ B | |
| O15 | Gestión de rechazos SENIAT con checklist de corrección | ☐ Sí ☐ No | ☐ A ☐ M ☐ B | |
| O16 | Calendario de presentaciones anuales / vigilancia | ☐ Sí ☐ No | ☐ A ☐ M ☐ B | |
| O17 | Otra: ________________________________ | ☐ Sí ☐ No | ☐ A ☐ M ☐ B | |
| O18 | Otra: ________________________________ | ☐ Sí ☐ No | ☐ A ☐ M ☐ B | |
| O19 | Otra: ________________________________ | ☐ Sí ☐ No | ☐ A ☐ M ☐ B | |

**O20.** Si solo pudiera elegir **tres** mejoras para el próximo ciclo, ¿cuáles serían?  
1. ___________________________________________________________________________  
2. ___________________________________________________________________________  
3. ___________________________________________________________________________

---

## P. Orden del flujo y obligatoriedad

| Pregunta | Sí | No | Parcial | Observaciones |
|----------|----|----|---------|---------------|
| ¿El orden 1→10 (+ nacionalización) refleja su proceso real? | ☐ | ☐ | ☐ | ¿Qué fase movería? ____ |
| ¿Pueden algunas fases ejecutarse en paralelo? | ☐ | ☐ | ☐ | ¿Cuáles? ____ |
| ¿Hay fases que deban poder omitirse según régimen? | ☐ | ☐ | ☐ | |
| ¿Prefieren menos bloqueos (más documentos opcionales) o más control (todo obligatorio)? | — | — | — | ☐ Flexible ☐ Estricto ☐ Mixto |

---

## Q. Cierre y firma de validación

**Resumen ejecutivo (llenar en la reunión)**

- Fases validadas sin cambios: _______________________________________________  
- Fases con cambios acordados: _____________________________________________  
- Documentos a agregar al catálogo: ________________________________________  
- Documentos a eliminar o hacer opcionales: ________________________________  
- Funciones adicionales prioritarias (A): __________________________________  
- Próxima reunión / fecha de confirmación: _________________________________

| Rol | Nombre | Firma | Fecha |
|-----|--------|-------|-------|
| Cliente — responsable operativo | | | |
| Cliente — responsable legal / aduana *(si aplica)* | | | |
| Nuestro lado — producto / implementación | | | |

---

*Documento de trabajo — SmartImport / Puerto Libre. Basado en el flujo canónico de planilla rev. 2 (fases 1–10 + nacionalización M2/M3). No sustituye asesoría legal; valida el alcance funcional del expediente digital.*
