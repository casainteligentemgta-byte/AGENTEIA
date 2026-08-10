# Pack de revisión — Puerto Libre / Importación

**Orden obligatorio** (validar en esta secuencia). Ruta base: `apps/smartaller/`.

Enlaces GitHub (branch `cursor/seniat-formulario-campos-3dab`): prefijo
`https://github.com/casainteligentemgta-byte/AGENTEIA/blob/cursor/seniat-formulario-campos-3dab/apps/smartaller/`.

---

## 1. Estados reales — `expediente.ts` + `nacionalizacion.ts`

| Archivo | Qué contiene | Qué **no** contiene |
|---------|--------------|---------------------|
| [`lib/importacion/expediente.ts`](../lib/importacion/expediente.ts) | `PL-Y.M.N`, parse/format, `NP-*`, `placaRealVisible` | Transiciones `estadoSeniat` / `estadoNacionalizacion` |
| [`lib/importacion/nacionalizacion.ts`](../lib/importacion/nacionalizacion.ts) | Vía M2/M3, `fechaLimitePermanencia3Anios`, docs faltantes | Setters de estado |

**Transiciones reales** (seguir a estos archivos después del §1):

| Evento | Dónde | Valor |
|--------|-------|--------|
| Alta | `importacion-vehiculo.ts` ~305–306 | `estadoNacionalizacion: pendiente`, `estadoSeniat: pendiente` |
| Elegir vía | `elegirViaNacionalizacionAction` ~1119 | `en_proceso` |
| Avanzar paso | `avanzarPasoNacionalizacionAction` ~1178 | mantiene `en_proceso` |
| Completar nac. | `completarNacionalizacionAction` ~1232–1233 | `nacionalizado` + `estadoSeniat: presentada` |
| Enums / buckets | `lib/schemas/vehiculo-documentos.ts` 278–290, 615–624 | `ESTADOS_*`, `esProximoSeniat`, `esProximoNacionalizar` |

**Validar:** no hay `rechazada`; `agendada`/`no_aplica` sin action automática; sí hay `en_proceso` (no salto directo pendiente→nacionalizado).

---

## 2. Auth en mutaciones — `importacion-vehiculo.ts`

Archivo: [`app/actions/nfc/importacion-vehiculo.ts`](../app/actions/nfc/importacion-vehiculo.ts)

| Qué mirar | Líneas aprox. |
|-----------|----------------|
| `requireTallerAuth` / `assertVehiculoTaller` | 109–117 |
| Schema `forzarImprontaSinVerificar` | 101 |
| `savePuertoLibreFase2LlegadaAction` | 711–798 |
| Gate impronta (`no_coincide` bloquea; forzar acepta `no_leido`) | 736–750 |

**Validar:** cada action mutante llama `requireTallerAuth` + (si hay `vehiculoId`) `assertVehiculoTaller` / `.eq("taller_id", …)`.

**Hallazgo crítico:** `forzarImprontaSinVerificar` se acepta **sin** chequeo de rol portal (solo auth de taller). Usa `createAdminClient()` → salta RLS.

Audit: `npm run audit:importacion-auth` (también en `npm run qa`).

---

## 3. Roles — `access.ts` (y el “forzar” que **no** está aquí)

Archivo: [`lib/importacion/access.ts`](../lib/importacion/access.ts)

| Helper | Líneas | Comportamiento |
|--------|--------|----------------|
| `canAccessAllImportacionData` | 47–52 | master/admin/aduanera + `verTodo` |
| `canMutateImportacionData` | 65–69 | master/admin; aduanera+verTodo = **solo lectura**; taller/concesionario con `tallerIds` |
| `isImportacionUsuarioOnly` | 72–77 | rol `usuario` |
| `resolveImportacionTallerScope` | 80–95 | alcance por taller / global / usuario |

**Validar:** la lógica de “forzar avance” de impronta **no** vive en este archivo. `canMutateImportacionData` existe pero `savePuertoLibreFase2LlegadaAction` **no la usa** para restringir el forzar.

---

## 4. Migración roles/logs — ¿RLS o tablas planas?

Archivo: [`supabase/migrations/20260809120000_importacion_roles_login_logs.sql`](../supabase/migrations/20260809120000_importacion_roles_login_logs.sql)

| Bloque | Qué hace | RLS |
|--------|----------|-----|
| `portal_accesos` roles | CHECK con master/admin/aduanera/taller/concesionario/usuario | (tabla ya existente) |
| `portal_login_logs` | create + índices | **Sí** `ENABLE ROW LEVEL SECURITY`; política **solo `service_role`**; **sin** políticas para `authenticated` |
| `vehiculo_compartidos` | create + unique | **Sí** RLS: SELECT propio (`user_id = auth.uid()`) + all `service_role` |

**Conclusión:** no son “tablas planas” sin RLS: hay RLS activado. Escritura/lectura de logs queda cerrada a service_role (app). **No** define INSERT/UPDATE/DELETE de `vehiculos`.

Complemento en este PR: `20260810120000_vehiculos_rls_taller_mutations.sql` (mutaciones `vehiculos` si `taller_id = get_my_taller_id()`). Las actions PL con admin client **siguen saltando** ese RLS.

---

## 5. Buckets dashboard + checkbox forzar — planilla / page

### Buckets (no hay dashboard “viejo” desconectado)

Archivo: [`app/importacion/(modulo)/page.tsx`](../app/importacion/(modulo)/page.tsx)

| Label UI | Condición (aprox.) |
|----------|---------------------|
| Por cargar docs de embarque | `planillaFase === 1` && sin `fechaIngreso` |
| Por recibir en puerto | sin ingreso && (`fase` null \|\| `2`) |
| Pendiente a completar | `fase` null \|\| `< 7` |
| Por presentación SENIAT | `esProximoSeniat` |
| Por nacionalizar | `esProximoNacionalizar` (+ UI pasiva de días al plazo) |

Helpers de bucket: `vehiculo-documentos.ts` `esProximoSeniat` / `esProximoNacionalizar`.

### Forzar impronta UI

Archivo: [`components/nfc/PlanillaRegistroImportacion.tsx`](../components/nfc/PlanillaRegistroImportacion.tsx) — `Fase2Llegada` ~958–1165

- `canForce` si hay foto y estado `no_leido` o `null` (~1008–1010)
- Checkbox sin filtro por rol portal (~1092–1105)
- Envía `forzarImprontaSinVerificar` a la action del §2 (~446–456, ~1165)

**Validar punto 3 (buckets):** labels y filtros ya usan `planillaFase` + helpers actuales; no hay segundo set de buckets legacy en esta page.

---

## Limitaciones conocidas (fuera del pack)

1. Sin estado SENIAT `rechazada` / flujo de corrección.
2. Sin alertas/cron para `fechaLimiteNacionalizacion` ni `seguro.vigenciaHasta`.
3. `numeroExpediente` eliminado; correlativo N se deriva de `codigoExpediente`.

Contexto completo: [`PUERTO-LIBRE-CONTEXT.md`](./PUERTO-LIBRE-CONTEXT.md).
