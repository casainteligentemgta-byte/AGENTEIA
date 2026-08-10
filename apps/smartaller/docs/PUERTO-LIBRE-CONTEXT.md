# CONTEXTO: Módulo Importación / Puerto Libre — Smartaller (`apps/smartaller`)

Documento de referencia para agentes/IA. Toda respuesta sobre importación, SENIAT, aduana, planilla o expedientes PL debe basarse aquí. Stack: Next.js 14 App Router, Server Actions, Supabase (JSONB), Zod, Tailwind. Base path: `/importacion`. No inventar rutas, columnas ni campos que no estén aquí.

---

## 1. Concepto de negocio

Puerto Libre (Venezuela) es un régimen de importación de vehículos. Smartaller gestiona el **expediente digital** de cada unidad desde el embarque hasta nacionalización / matrícula.

Distinciones críticas:

| Concepto | Campo | Ejemplo / regla |
|----------|-------|-----------------|
| Expediente interno PL | `codigoExpediente` | `PL-{año}.{mes}.{N}` — ej. `PL-2026.8.1`. Mes **sin** zero-pad. Secuencia por taller + año + mes. El correlativo **N** se deriva parseando este código (`parseCodigoExpediente`). **No existe** campo `numeroExpediente` (eliminado por redundante). |
| Expediente SENIAT | `numeroExpedienteSeniat` | Asignado por SENIAT; distinto del PL. |
| VIN | `importacion.vin` | VIN internacional. |
| Serial carrocería | `vehiculos.serial_carroceria` | Dato SENIAT; a veces ≠ VIN. Unicidad por taller. |
| Placa pendiente | `placa` | Placeholder `NP-{año}.{mes}.{N}` hasta matrícula. |
| Placa real | `placa` | No puede ser igual a un código PL. |

---

## 2. Flujo de la planilla (`planillaFase` 1–7)

Persistido en `vehiculos.importacion.planilla_fase`. UI: `?fase=1|1a|2|3|4|5|6`.

```
Alta → fase 1 (Registro)
  → UI 1a Embarque (docs) → complete → fase 2
  → Llegada (fecha + fotos + checklist + impronta) → fase 3
  → Aduana (CVA/DUA) → fase 4
  → Propietario/comprador → fase 5
  → Seguro → fase 6 (carpeta → placa) → fase 7 (planilla completa)
  → /nacionalizar (M2 o M3) → nacionalizado
```

### Fase 1 — Registro

Formulario: vehículo + importador + datos importación. OCR/adjuntos opcionales.

Campos clave: marca, modelo, color, año, serialMotor, **vin**, serialCarroceria, kilometraje, condicion (`nuevo`|`usado`), esSubasta (si usado), partidaArancelaria, cilindradaCc, tipoCombustible, fechaLlegadaBuque, importador (nombre, RIF, tel, email, **dirección fiscal**), aduana, numeroBl, paisOrigen, valorCif, **tasaCambioBcv**, **numeroExpedienteSeniat**, numeroDav, numeroCertificadoOrigen, numeroListaEmpaque, numeroPolizaTransporte, observaciones.

Reglas: usado → esSubasta obligatorio y km > 0; nuevo → km puede ser 0; RIF formato `J|V|E|G|P|C-########-#` si se llena.

Al crear: `planillaFase=1`, `estadoNacionalizacion=pendiente`, `estadoSeniat=pendiente`, `regimen="Puerto Libre"`.

### Fase 1a — Embarque (UI; BD pasa a 2 al completar)

Docs obligatorios (`PL_EMBARQUE_DOCUMENTO_TIPOS`):
`factura_comercial`, `certificado_origen`, `bl_guia`, `lista_empaque`, `dav`, `poliza_transporte`.

Action: `completePuertoLibreFase1aEmbarqueAction` → fase 2.

### Fase 2 — Llegada

`fechaIngreso`, memoria fotográfica (7), checklist (14 ítems), verificación OCR de `foto_impronta` vs `serial_carroceria`.

Estados impronta: `coincide | no_coincide | no_leido`. Sin `coincide` no avanza, salvo **forzar** si OCR quedó en `no_leido`.

**Forzar impronta (`forzarImprontaSinVerificar`):** solo operadores con `canForzarImprontaSinVerificar` (= `canMutateImportacionData`: master/admin/taller/concesionario). Rol `usuario` y aduanera solo-lectura: UI sin checkbox; Server Action rechaza el flag. `no_coincide` bloquea siempre (nadie puede forzar).

Action: `savePuertoLibreFase2LlegadaAction` → fase 3.

### Fase 3 — Aduana

Doc: `nacionalizacion` (liquidación CVA/DUA).  
`completePuertoLibreFase3Action` → fase 4.

### Fase 4 — Propietario

Comprador: nombre (obligatorio), cédula, tel, email, dirección (`compradorDireccion`).  
`completePuertoLibreFase4PropietarioAction` → fase 5.

### Fase 5 — Seguro del vehículo

`aseguradora` obligatoria + docs (`poliza_seguro`, `certificado_seguro`, `recibo_seguro`, `rcv_seguro`).  
≠ póliza de **transporte** del embarque.  
`completePuertoLibreFase5SeguroAction` → fase 6.

### Fase 6 — Matriculación

Subpaso 1 (`matriculacionPaso=1`): carpeta docs → paso 2.  
Subpaso 2: registrar placa real.  
Al completar → **fase 7** y `fechaLimiteNacionalizacion` = fechaIngreso + 3 años (si falta).

### Fase 7 — Planilla completa

Habilita wizard `/importacion/[id]/nacionalizar`.

---

## 3. Nacionalización (post planilla)

Gate: `planillaFase >= 7`.

Vías (`viaNacionalizacion`):

- **cambio_regimen (M2)**: &lt; 3 años desde `fechaIngreso`.
- **permanencia (M3)**: ≥ 3 años.

### Transiciones de `estadoNacionalizacion`

| Valor | Quién lo setea |
|-------|----------------|
| `pendiente` | Alta / carga masiva |
| `en_proceso` | `elegirViaNacionalizacionAction` (elige M2/M3) y `avanzarPasoNacionalizacionAction` |
| `nacionalizado` | `completarNacionalizacionAction` (+ fuerza `estadoSeniat: presentada`) |
| `no_aplica` | **Solo** override manual en Editar ficha (`PuertoLibreFichaClient`). Sin caso de negocio automatizado. |

### Transiciones de `estadoSeniat`

| Valor | Quién lo setea |
|-------|----------------|
| `pendiente` | Alta / carga masiva |
| `agendada` | **Solo** override manual en Editar ficha. No hay action/fase “Agendar cita SENIAT”. El dashboard sí la contempla (`esProximoSeniat`). |
| `presentada` | `completarNacionalizacionAction` |
| `no_aplica` | **Solo** override manual en Editar ficha. |

Enums:

- `estadoNacionalizacion`: `pendiente | en_proceso | nacionalizado | no_aplica`
- `estadoSeniat`: `pendiente | agendada | presentada | no_aplica`

Helpers:

- `esProximoNacionalizar` = fase ≥ 7 **y** (`pendiente` **o** `en_proceso`) — **no** distingue “no empezó wizard” vs “a mitad”.
- `esProximoSeniat` = `pendiente` **o** `agendada`.

---

## 4. Dashboard `/importacion` — buckets reales (UI)

El dashboard **ya está conectado** a `planillaFase` (1–7). Labels y filtros exactos en `app/importacion/(modulo)/page.tsx`:

| Label UI | Variable | Condición | Destino típico |
|----------|----------|-----------|----------------|
| **Por cargar docs de embarque** | `porEmbarque` | `planillaFase === 1` && sin `fechaIngreso` | `?fase=1a` (solo se renderiza si hay ítems) |
| **Por recibir en puerto** | `porRecibir` | sin `fechaIngreso` && (`planillaFase` null \|\| `=== 2`) | `?fase=2` |
| **Pendiente a completar** | `pendientes` | `planillaFase` null \|\| `< 7` | `completarHref` → `?fase=1`…`6` según fase |
| **Por presentación SENIAT** | `porSeniat` | `proximoSeniat` / `esProximoSeniat` | `/nacionalizar` |
| **Por nacionalizar** | `porNacionalizar` | `proximoNacionalizar` / `esProximoNacionalizar` | `/nacionalizar` |

Notas:

- Fase 1 (sin docs de embarque) **no** entra en “Por recibir en puerto”; va a “Por cargar docs de embarque”.
- “Pendiente a completar” es amplio (cualquier planilla incompleta) y puede solapar visualmente con otros buckets; cada fila usa `completarHref(v)` según fase.
- SENIAT es un **bucket propio**, no un alias de “Por nacionalizar”.

---

## 5. Modelo de datos

### Tabla `vehiculos` (columnas PL)

`id`, `taller_id`, `placa`, `marca`, `modelo`, `color`, `serial_motor`, `serial_carroceria`, `kilometraje_ultimo`, `unidad_odometro`, `nombre_cliente`, `telefono_cliente`, `cedula_propietario`, `email_propietario`, `fecha_nacimiento_propietario`, `documentos` jsonb, `importacion` jsonb, `seguro` jsonb, `inspeccion_transportista` jsonb, `pin_hash`, timestamps.

### JSONB `importacion` (TS camelCase ↔ snake en serialize)

`regimen`, `aduana`, `fechaIngreso`, `fechaLlegadaBuque`, `numeroBl`, `paisOrigen`, `valorCif`, `tasaCambioBcv`, `numeroExpedienteSeniat`, `numeroDav`, `numeroCertificadoOrigen`, `numeroListaEmpaque`, `numeroPolizaTransporte`, `agenteAduanal`, `observaciones`, `estadoNacionalizacion`, `fechaLimiteNacionalizacion`, `viaNacionalizacion`, `nacionalizacionPaso` (1–4), `estadoSeniat`, `fechaPresentacionSeniat`, `anio`, `condicionVehiculo`, `esSubasta`, `vin`, `partidaArancelaria`, `cilindradaCc`, `tipoCombustible` (`gasolina|diesel|electrico|hibrido|gnv|otro`), `importadorNombre` / `Documento` / `Telefono` / `Email` / `Direccion`, `planillaFase` (1–7), `matriculacionPaso` (1–2), `codigoExpediente`, `checklistLlegada`, `checklistLlegadaNotas`, `otrosDispositivosNotas`, `serialImprontaEstado` / `Leido` / `VerificadoAt`, `compradorDireccion`.

**No usar / no reintroducir:** `numeroExpediente` (correlativo N denormalizado; se deriva de `codigoExpediente`).

### JSONB `documentos`

Por tipo: `{ url, path, scanned_at?, file_name? }`.

Grupos:

- Embarque: `factura_comercial`, `certificado_origen`, `bl_guia`, `lista_empaque`, `dav`, `poliza_transporte`
- Aduana: `nacionalizacion`
- Fotos: `foto_frontal`, `foto_trasera`, `foto_lateral_izq`, `foto_lateral_der`, `foto_motor`, `foto_impronta`, `foto_odometro` (+ `foto_vin`, `foto_danos`, `foto_placa`, `foto_comprador`)
- Seguro: `poliza_seguro`, `certificado_seguro`, `recibo_seguro`, `rcv_seguro`
- Matriculación extras: `experticia_verificacion_legal`, `planilla_sumica_put`, `pago_tasas`
- Nacionalización: `declaracion_complementaria`, `liquidacion_nacionalizacion`, `resolucion_liberacion_seniat`, `constancia_residencia_permanencia`, `solicitud_levantamiento_intt`, `titulo_libre_circulacion`

### JSONB `seguro`

`aseguradora`, `numeroPoliza`, `tipoCobertura`, `vigenciaDesde`/`Hasta`, `montoAsegurado`, `telefonoAseguradora`, `corredor`, `observaciones`, `tieneAlarma`, `tieneGps`, `tieneInmovilizador`, `dispositivosSeguridad`, `contactoEmergencia`, `telefonoEmergencia`.

**RLS y defensa en profundidad**

| Capa | Qué hace |
|------|----------|
| RLS `authenticated` | SELECT/INSERT/UPDATE/DELETE de `vehiculos` solo si `taller_id = get_my_taller_id()`. Migración `20260810120000_vehiculos_rls_taller_mutations.sql` (antes solo había SELECT por taller). `nfc_stickers` ya tenía CRUD por taller. |
| Service role | Las Server Actions de PL usan `createAdminClient()` → **saltan RLS**. Obligatorias: `requireTallerAuth` (o `getUser`+`getMyTaller`) y, en mutaciones por id, `assertVehiculoTaller` / filtro `taller_id`. |
| Audit estático | `npm run audit:importacion-auth` (también en `npm run qa`) falla si una action exportada en `app/actions/nfc` olvida el gate o muta `vehiculos` con admin sin ownership. Exentos: `verify-nfc` (público), `extractPuertoLibreDocumentoAction` (solo OCR). |

**Riesgo residual:** un endpoint nuevo con service role y sin el gate sigue pudiendo filtrar datos entre talleres. No sustituir el audit ni el checklist de PR por “ya hay RLS”. A medio plazo, preferir migrar mutaciones PL al cliente de usuario (RLS aplica) y reservar admin para webhooks/NFC públicos/portales multi-taller.

---

## 6. Rutas

| Ruta | Uso |
|------|-----|
| `/importacion/login` | Login del módulo |
| `/importacion` | Dashboard (buckets de la sección 4) |
| `/importacion/vehiculos/nuevo` o `/importacion/nuevo` | Alta |
| `/importacion/carga-masiva` | Excel/CSV + OCR multi |
| `/importacion/carga-masiva/[formato]` | Plantilla csv/xlsx |
| `/importacion/[vehiculoId]` | Ficha / expediente |
| `/importacion/[vehiculoId]/planilla?fase=` | Planilla por fases |
| `/importacion/[vehiculoId]/nacionalizar` | Wizard M2/M3 |
| `/importacion/[vehiculoId]/propietario` | Plantilla comprador |
| `/importacion/[vehiculoId]/inspeccion` | Acta transportista |
| `/importacion/[vehiculoId]/expediente.pdf` | PDF |
| `/importacion/hoja-inspeccion` | Hoja inspección |
| `/importacion/admin/ingresos` | Logs login (solo master) |
| `/v/[token]` | Sticker NFC público |

---

## 7. Archivos clave

**Schemas:** `lib/schemas/vehiculo-documentos.ts`, `lib/schemas/importacion-alta.ts`, `lib/validations/rif.ts`, `lib/schemas/inspeccion-transportista.ts`

**Actions:** `app/actions/nfc/importacion-vehiculo.ts`, `importacion-extract.ts`, `importacion-impronta.ts`, `importacion-carga-masiva.ts`, `inspeccion-transportista.ts`, `nfc-management.ts`, `verify-nfc.ts`

**UI:** `PuertoLibreFase1Form.tsx`, `PuertoLibreDocScan.tsx`, `PlanillaRegistroImportacion.tsx`, `PlanillaAltaPuertoLibre.tsx`, `PuertoLibreRegistroWizard.tsx`, `PuertoLibreCargaMasiva.tsx`, `PuertoLibreNacionalizarWizard.tsx`, `PuertoLibreExpedienteView.tsx`, `PuertoLibreFichaClient.tsx`, `PuertoLibreExpedienteNfc.tsx`, `ImportDocumentoUpload.tsx`

**Lib:** `lib/importacion/expediente.ts`, `nacionalizacion.ts`, `access.ts`, `paths.ts`, `carga-masiva-template.ts`, `expediente-pdf.ts`, `llegada-catalog.ts`, `lib/extract-puerto-libre-docs.ts`, `lib/extract-impronta.ts`, `lib/taller-preferencias.ts`

**Dashboard:** `app/importacion/(modulo)/page.tsx`

---

## 8. Auth y roles

Módulo aislado con login propio. Layout `(modulo)` exige sesión + `canAccessImportacion`.

Roles: `master`, `admin`, `aduanera`, `taller`, `concesionario`, `usuario`.

- Mutar: master/admin (scope) o taller/concesionario con `tallerIds`.
- Aduanera con `verTodo`: solo lectura.
- Usuario: solo vehículos propios/compartidos.
- Mutaciones: `requireTallerAuth()` + ownership.

Preferencias taller: último importador prellenado (`talleres.preferencias.ultimoImportador`).

---

## 9. Automatizaciones

1. **DocScan (Fase 1):** OCR (OpenAI) solo en `factura_comercial` y `bl_guia`. Certificado origen, lista empaque, DAV, póliza transporte = adjunto sin OCR.
2. **Carga masiva:** CSV/XLSX (máx 80) o OCR multi-doc; dedupe por serial carrocería; crea fase 1 + códigos PL secuenciales.
3. **Impronta:** OCR vs `serial_carroceria`; bloquea fase 2 si no coincide.
4. **PDF:** `buildExpedientePdf`.
5. **NFC:** `nfc_stickers`, PIN en `pin_hash`, `/v/{token}`.
6. **Inspección transportista:** `inspeccion_transportista`; puede sync docs/placa/km.

---

## 10. Reglas al modificar código

1. Server-first; Server Actions + Zod en el límite.
2. Campos nuevos de importación → `importacionSchema` + parse + serialize + alta schema + form Fase 1 + vista/PDF/carga masiva si aplica.
3. Docs nuevos → `DOCUMENTO_TIPOS` + labels + grupo (EMBARQUE/ADUANA/etc.).
4. No confundir póliza de transporte (embarque) con póliza de seguro del vehículo (fase 5).
5. No confundir `codigoExpediente` (PL) con `numeroExpedienteSeniat`. No reintroducir `numeroExpediente`.
6. No confundir VIN con serial carrocería.
7. Unicidad: `serial_carroceria` por taller.
8. Nacionalización: `pendiente` → `en_proceso` (elegir vía) → `nacionalizado` (completar). No documentar un salto directo pendiente→nacionalizado.
9. Dashboard: usar los **labels y condiciones de la sección 4**, no parafrasearlos.
10. Seguridad: toda Server Action nueva de Importación que use `createAdminClient` debe llamar `requireTallerAuth` (o `getUser`+`getMyTaller`) y filtrar por `taller_id` / `assertVehiculoTaller`. Correr `npm run audit:importacion-auth` antes de merge.
11. Responder en español; KISS y tipado estricto.
