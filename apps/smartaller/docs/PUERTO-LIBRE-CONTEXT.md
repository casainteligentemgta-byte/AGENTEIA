# CONTEXTO: Módulo Importación / Puerto Libre — Smartaller (`apps/smartaller`)

> **App independiente:** el producto canónico es `apps/importacion`. Este módulo en SmartTaller se mantiene hasta definir `IMPORTACION_APP_URL` (redirect). Ver `apps/importacion/README.md`.

Documento de referencia para agentes/IA. Toda respuesta sobre importación, SENIAT, aduana, planilla o expedientes PL debe basarse aquí. Stack: Next.js 14 App Router, Server Actions, Supabase (JSONB), Zod, Tailwind. Base path: `/smartimport`. No inventar rutas, columnas ni campos que no estén aquí.

**Instructivo operativo (humano):** `docs/INSTRUCTIVO-IMPORTACION.md` · UI: `/smartimport/instructivo`.

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

## 2. Flujo de la planilla (`planillaFase` 1–8)

Persistido en `vehiculos.importacion.planilla_fase`. UI: `?fase=1|2|3|4|5|6|7` (`1a` legacy → 2).

```
Alta → fase 1 (Registro: datos + factura de compra + certificado de origen)
  → fase 2 Embarque (BL, lista de embarque, DAV, póliza transporte)
  → fase 3 Llegada (fecha + fotos + checklist + impronta)
  → fase 4 Desaduanamiento SENIAT (carpeta + Agente de Aduanas)
  → fase 5 Propietario
  → fase 6 Seguro
  → fase 7 Matrícula (carpeta → placa) → fase 8 (planilla completa)
  → /nacionalizar (M2 o M3) → nacionalizado
```

### Fase 1 — Registro

Formulario: vehículo + importador + datos importación. Docs obligatorios: factura de compra, certificado de origen.

Campos clave: marca, modelo, color, año, serialMotor, **vin**, serialCarroceria, kilometraje, condicion (`nuevo`|`usado`), esSubasta (si usado), partidaArancelaria, cilindradaCc, tipoCombustible, régimen, aduana, país origen, **puerto**, **modalidadTransito** (`ninguno|transito|uso24`), **aduanaTransito**, numeroBl, fechaLlegadaBuque, importador (nombre, RIF, tel, email, **dirección fiscal**), valorCif, **tasaCambioBcv**, **numeroExpedienteSeniat**, numeroDav, numeroCertificadoOrigen, numeroListaEmpaque, numeroPolizaTransporte, observaciones.

Reglas: usado → esSubasta obligatorio y km > 0; nuevo → km puede ser 0; RIF formato `J|V|E|G|P|C-########-#` si se llena.

Al crear: `planillaFase=1`, `estadoSeniat=pendiente`, `regimen` = uno de `ordinario|equipaje|puerto_libre|diplomatico|temporal` (default `puerto_libre`). `estadoNacionalizacion=pendiente` solo si Puerto Libre; otros → `no_aplica`.

Catálogo: `lib/importacion/regimenes.ts`. Misma planilla; desaduanamiento = carpeta base + docs extra del régimen. Nacionalización M2/M3 solo `puerto_libre`. Cupo persona natural: `equipaje` y `puerto_libre`.

Al continuar registro (docs OK): `planillaFase=2`.

### Fase 2 — Embarque

Docs (`PL_EMBARQUE_DOCUMENTO_TIPOS`): `bl_guia`, `lista_empaque`, `dav`, `poliza_transporte`.

Action: `completePuertoLibreFase2EmbarqueAction` → fase 3.

### Fase 3 — Llegada

`fechaIngreso`, documentos de llegada (`acta_recepcion_mercancia` AR + `constancia_edi_reconocimiento`), memoria fotográfica (7), checklist (14 ítems), verificación OCR de `foto_impronta` vs `serial_carroceria`.

Estados impronta: `coincide | no_coincide | no_leido`. Sin `coincide` no avanza, salvo **forzar** si OCR quedó en `no_leido`.

**Forzar impronta (`forzarImprontaSinVerificar`):** solo operadores con `canForzarImprontaSinVerificar` (= `canMutateImportacionData`: master/admin/taller/concesionario). Rol `usuario` y aduanera solo-lectura: UI sin checkbox; Server Action rechaza el flag. `no_coincide` bloquea siempre (nadie puede forzar).

Action: `savePuertoLibreFase2LlegadaAction` → fase 4.

### Fase 4 — Desaduanamiento SENIAT

Carpeta vía Agente de Aduanas (`agenteAduanal` obligatorio). Docs (`PL_DESADUANAMIENTO_DOCUMENTO_TIPOS`) — Expediente PDF SENIAT:

1. `cedula_importador`  
2. `rif_importador` (dirección Nueva Esparta, Venezuela)  
3. `lista_empaque` (desde Embarque o carga aquí)  
4. `nacionalizacion` (DUA)  
5. `dav`  
6. `sencamer`  
7. `registro_puerto_libre` — solo importador persona jurídica  
8. `agente_aduanal_doc`  
9. `constancia_edi_reconocimiento` (desde Llegada)  
10. `pase_salida_levante`  
11. `cancelacion_gastos_portuarios` (portuarios, almacén y manipulación)

PDF: `GET /smartimport/[id]/desaduanamiento.pdf` (`buildDesaduanamientoPdf`) — botón «Generar / descargar Expediente PDF SENIAT».  
`completePuertoLibreFase3Action({ vehiculoId, agenteAduanal })` → fase 5.

### Fase 5 — Propietario

Comprador: nombre (obligatorio), cédula, tel, email, dirección (`compradorDireccion`).  
`completePuertoLibreFase4PropietarioAction` → fase 6.

### Fase 6 — Seguro del vehículo

`aseguradora` obligatoria + docs (`poliza_seguro`, `certificado_seguro`, `recibo_seguro`, `rcv_seguro`).  
≠ póliza de **transporte** del embarque.  
`completePuertoLibreFase5SeguroAction` → fase 7.

### Fase 7 — Matriculación (INTT)

Subpaso 1 (`matriculacionPaso=1`): carpeta INTT.

**Cargar:** `inspeccion_pnb`, `homologacion` (si `requiereHomologacion`), `planilla_sumica_put` (PUT), `pago_tasas` (planilla de pago).

**Presentar en físico** (deben estar en el expediente): factura, B/L, DUA, liquidación **o** exención, experticia, RCV, cédula, RIF, constancia de residencia.

Subpaso 2: carga `titulo` (foto/PDF) + `foto_placa` + registra el número de placa PL.  
Al completar → **fase 8** y `fechaLimiteNacionalizacion` = fechaIngreso + 3 años (si falta).

### Fase 8 — Planilla completa

Habilita wizard `/smartimport/[id]/nacionalizar`.

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
| `pendiente` | Alta / carga masiva; también `resolverRechazoSeniatAction` si no había presentación formal |
| `agendada` | **Solo** override manual en Editar ficha. No hay action/fase “Agendar cita SENIAT”. El dashboard sí la contempla (`esProximoSeniat`). |
| `presentada` | `completarNacionalizacionAction`; `resolverRechazoSeniatAction` si había `fechaPresentacionSeniat` |
| `rechazada` | `marcarRechazoSeniatAction` (motivo + fecha + historial). **No** cambia `planillaFase`. |
| `no_aplica` | **Solo** override manual en Editar ficha. |

Enums:

- `estadoNacionalizacion`: `pendiente | en_proceso | nacionalizado | no_aplica`
- `estadoSeniat`: `pendiente | agendada | presentada | rechazada | no_aplica`

Helpers:

- `esProximoNacionalizar` = fase ≥ 7 **y** (`pendiente` **o** `en_proceso`) — **no** distingue “no empezó wizard” vs “a mitad”.
- `esProximoSeniat` = `pendiente` **o** `agendada`.
- `esRechazadoSeniat` = `rechazada` (bucket propio en dashboard).

Alertas email (Vercel Cron `/api/cron/alertas-vencimiento`, 13:00 UTC ≈ 09:00 VET): deadline 90d + seguro 30d vía Resend; cooldown 30d (`ultimaAlertaDeadlineEnviada` / `ultimaAlertaSeguroEnviada`).

**UI — días restantes:** banner `AlertaDiasNacionalizacion` en `/nacionalizar` y ficha del expediente (`buildAlertaNacionalizacion`: ok / aviso ≤90d / urgente ≤30d / hoy / vencido). Dashboard «Por nacionalizar» marca urgente ≤30d.

---

## 4. Dashboard `/smartimport` — buckets reales (UI)

El dashboard **ya está conectado** a `planillaFase` (1–7). Labels y filtros exactos en `app/importacion/(modulo)/page.tsx`:

| Label UI | Variable | Condición | Destino típico |
|----------|----------|-----------|----------------|
| **Por cargar docs de embarque** | `porEmbarque` | `planillaFase === 1` && sin `fechaIngreso` | `?fase=1a` (solo se renderiza si hay ítems) |
| **Por recibir en puerto** | `porRecibir` | sin `fechaIngreso` && (`planillaFase` null \|\| `=== 2`) | `?fase=2` |
| **Pendiente a completar** | `pendientes` | `planillaFase` null \|\| `< 7` | `completarHref` → `?fase=1`…`6` según fase |
| **Por presentación SENIAT** | `porSeniat` | `proximoSeniat` / `esProximoSeniat` | `/nacionalizar` |
| **Rechazados SENIAT** | `rechazadosSeniat` | `estadoSeniat === "rechazada"` (ordenado por `fechaRechazoSeniat` desc) | ficha `/smartimport/[id]` |
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

`regimen`, `aduana`, `puerto`, `modalidadTransito`, `aduanaTransito`, `fechaIngreso`, `fechaLlegadaBuque`, `numeroBl`, `paisOrigen`, `valorCif`, `tasaCambioBcv`, `numeroExpedienteSeniat`, `numeroDav`, `numeroCertificadoOrigen`, `numeroListaEmpaque`, `numeroPolizaTransporte`, `agenteAduanal`, `observaciones`, `estadoNacionalizacion`, `fechaLimiteNacionalizacion`, `viaNacionalizacion`, `nacionalizacionPaso` (1–4), `estadoSeniat`, `fechaPresentacionSeniat`, `anio`, `condicionVehiculo`, `esSubasta`, `vin`, `partidaArancelaria`, `cilindradaCc`, `tipoCombustible` (`gasolina|diesel|electrico|hibrido|gnv|otro`), `importadorId` (FK lógica a `importadores`), `importadorNombre` / `Documento` / `Telefono` / `Email` / `Direccion` (snapshot), `planillaFase` (1–8), `matriculacionPaso` (1–2), `requiereHomologacion`, `codigoExpediente`, `checklistLlegada`, `checklistLlegadaNotas`, `otrosDispositivosNotas`, `serialImprontaEstado` / `Leido` / `VerificadoAt`, `compradorDireccion`.

### Tabla `importadores` (clientes)

Personas naturales o jurídicas por taller. Migraciones `20260811010000_importadores_clientes.sql` + `20260811020000_importadores_campos_natural_juridica.sql` (RLS por `taller_id`).

- **Natural:** nombres/apellidos, RIF, cédula, email, teléfono, dirección, Instagram.
- **Jurídica:** denominación comercial, razón social, RIF, representante legal (nombre, cédula, email, teléfono), teléfono/email/domicilio empresa, **nº registro Puerto Libre** + **fecha vencimiento**.
- Display: `nombre` / `documento` (RIF). El alta de importación exige elegir/crear cliente primero; el JSONB guarda `importadorId` + snapshot denormalizado.

**No usar / no reintroducir:** `numeroExpediente` (correlativo N denormalizado; se deriva de `codigoExpediente`).

### JSONB `documentos`

Por tipo: `{ url, path, scanned_at?, file_name? }`.

Grupos:

- Registro: `factura_comercial`, `certificado_origen`
- Embarque: `bl_guia`, `lista_empaque`, `poliza_transporte`
- Llegada: `acta_recepcion_mercancia`, `constancia_edi_reconocimiento`
- Desaduanamiento (Expediente SENIAT): `cedula_importador`, `rif_importador`, `lista_empaque`, `nacionalizacion` (DUA), `dav`, `sencamer`, `registro_puerto_libre` (solo jurídica), `agente_aduanal_doc`, `constancia_edi_reconocimiento`, `pase_salida_levante`, `cancelacion_gastos_portuarios`
- Fotos: `foto_frontal`, `foto_trasera`, `foto_lateral_izq`, `foto_lateral_der`, `foto_motor`, `foto_impronta`, `foto_odometro` (+ `foto_vin`, `foto_danos`, `foto_placa`, `foto_comprador`)
- Seguro: `poliza_seguro`, `certificado_seguro`, `recibo_seguro`, `rcv_seguro`
- Matriculación INTT: `inspeccion_pnb`, `homologacion` (opcional), `planilla_sumica_put`, `pago_tasas`; físico: factura, B/L, DUA, liquidación/exención, experticia, RCV, cédula, RIF, constancia; entrega: `titulo` + placa PL
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
| `/smartimport/login` | Login del módulo |
| `/smartimport` | Dashboard (buckets de la sección 4) |
| `/smartimport/importaciones/nueva` | Alta de importación (cliente → vehículo) |
| `/smartimport/vehiculos/nuevo` | Redirect a `/smartimport/importaciones/nueva` |
| `/smartimport/clientes` | Tabla de clientes importadores |
| `/smartimport/nuevo` | Nuevo sticker NFC (no es el alta PL) |
| `/smartimport/carga-masiva` | Excel/CSV + OCR multi |
| `/smartimport/carga-masiva/[formato]` | Plantilla csv/xlsx |
| `/smartimport/biblioteca-legal` | Biblioteca legal + reglas de cumplimiento |
| `/smartimport/[vehiculoId]` | Ficha / expediente |
| `/smartimport/[vehiculoId]/desaduanamiento.pdf` | PDF carpeta desaduanamiento |
| `/smartimport/[vehiculoId]/planilla?fase=` | Planilla por fases |
| `/smartimport/[vehiculoId]/nacionalizar` | Wizard M2/M3 |
| `/smartimport/[vehiculoId]/propietario` | Plantilla comprador |
| `/smartimport/[vehiculoId]/inspeccion` | Acta transportista |
| `/smartimport/[vehiculoId]/expediente.pdf` | PDF |
| `/smartimport/hoja-inspeccion` | Hoja inspección |
| `/smartimport/admin/ingresos` | Logs login (solo master) |
| `/v/[token]` | Sticker NFC público |

---

## 7. Archivos clave

**Schemas:** `lib/schemas/vehiculo-documentos.ts`, `lib/schemas/importacion-alta.ts`, `lib/schemas/importador.ts`, `lib/validations/rif.ts`, `lib/schemas/inspeccion-transportista.ts`

**Actions:** `app/actions/nfc/importacion-vehiculo.ts`, `importadores.ts`, `importacion-extract.ts`, `importacion-impronta.ts`, `importacion-carga-masiva.ts`, `inspeccion-transportista.ts`, `nfc-management.ts`, `verify-nfc.ts`

**UI:** `RegistrarImportacionWizard.tsx`, `ImportadorForm.tsx`, `ImportadoresClientesPanel.tsx`, `PuertoLibreFase1Form.tsx`, `PuertoLibreDocScan.tsx`, `PlanillaRegistroImportacion.tsx`, `PlanillaAltaPuertoLibre.tsx`, `PuertoLibreRegistroWizard.tsx`, `PuertoLibreCargaMasiva.tsx`, `PuertoLibreNacionalizarWizard.tsx`, `PuertoLibreExpedienteView.tsx`, `PuertoLibreFichaClient.tsx`, `PuertoLibreExpedienteNfc.tsx`, `ImportDocumentoUpload.tsx`

**Lib:** `lib/importacion/expediente.ts`, `nacionalizacion.ts`, `normas-legales.ts`, `cumplimiento-importador.ts`, `access.ts`, `paths.ts`, `carga-masiva-template.ts`, `expediente-pdf.ts`, `llegada-catalog.ts`, `lib/extract-puerto-libre-docs.ts`, `lib/extract-impronta.ts`, `lib/taller-preferencias.ts`

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
4. **PDF:** `buildExpedientePdf` + `buildDesaduanamientoPdf`.
5. **NFC:** `nfc_stickers`, PIN en `pin_hash`, `/v/{token}`.
6. **Inspección transportista:** `inspeccion_transportista`; puede sync docs/placa/km.
7. **Cumplimiento (MVP):** `evaluarCupoPersonaNatural` en alta, fase 1 y carga masiva. RIF V/E = persona natural → máx. 1 vehículo en &lt; 3 años (mismo taller). Catálogo: `lib/importacion/normas-legales.ts` + UI `/smartimport/biblioteca-legal`.

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
