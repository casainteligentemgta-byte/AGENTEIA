# Guía de revisión de código — Puerto Libre / Importación

Orden sugerido de lectura para validar los hallazgos de la auditoría de producto.
Ruta base: `apps/smartaller/`.

---

## 1. `lib/importacion/expediente.ts` + `lib/importacion/nacionalizacion.ts`

**Qué validar:** códigos PL vs SENIAT; **no** aquí viven las transiciones de `estadoSeniat` / `estadoNacionalizacion`.

| Archivo | Responsabilidad real |
|---------|----------------------|
| `expediente.ts` | `PL-Y.M.N`, parse/format, placa `NP-*`, `placaRealVisible` |
| `nacionalizacion.ts` | Vía M2/M3 por años, `fechaLimitePermanencia3Anios`, docs faltantes |

**Transiciones de estado** están en:

- Schema/enums: `lib/schemas/vehiculo-documentos.ts` (`ESTADOS_SENIAT`, `ESTADOS_NACIONALIZACION`, `esProximoSeniat`, `esProximoNacionalizar`)
- Mutaciones: `app/actions/nfc/importacion-vehiculo.ts` → `elegirViaNacionalizacionAction` (`en_proceso`), `completarNacionalizacionAction` (`nacionalizado` + `estadoSeniat: presentada`)

**Hallazgos ya confirmados:**

- `agendada` / `no_aplica`: sin action automática; solo select en ficha.
- No existe `rechazada` / flujo de corrección SENIAT.
- `en_proceso` sí se setea al elegir vía (no es salto directo pendiente→nacionalizado).

---

## 2. `app/actions/nfc/importacion-vehiculo.ts`

**Qué validar:** cada action mutante llama `requireTallerAuth` + (si hay `vehiculoId`) `assertVehiculoTaller` / `.eq("taller_id", …)`.

**Patrón:** usa `createAdminClient()` → **salta RLS**. El gate de app es la defensa principal.

**Punto crítico — forzar impronta (fase 2):**

```ts
// savePuertoLibreFase2LlegadaAction
// - no_coincide → bloquea siempre
// - forzarImprontaSinVerificar → aceptado sin chequeo de rol portal
//   (solo requireTallerAuth + assertVehiculoTaller)
```

**Conclusión:** el “forzar” **no** está limitado a admin/taller vs usuario en el servidor. Ver también UI en §5.

**Audit estático:** `npm run audit:importacion-auth` (también en `npm run qa`).

---

## 3. `lib/importacion/access.ts`

**Qué validar:** roles y mutación; **no** contiene la lógica de forzar impronta.

| Helper | Comportamiento |
|--------|----------------|
| `canAccessAllImportacionData` | master/admin/aduanera + `verTodo` |
| `canMutateImportacionData` | master/admin; aduanera+verTodo = **false** (solo lectura); taller/concesionario con `tallerIds` |
| `isImportacionUsuarioOnly` | rol `usuario` |

**Gap:** `savePuertoLibreFase2LlegadaAction` **no** llama `canMutateImportacionData` ni filtra `forzarImprontaSinVerificar` por rol. `access.ts` define el permiso “correcto” para mutar, pero el forzar impronta no lo usa.

**Aduanera + verTodo:** portal de monitoreo (legacy en migraciones); sin consentimiento/aviso a importadores en producto.

---

## 4. Migraciones RLS

### Pedida: `supabase/migrations/20260809120000_importacion_roles_login_logs.sql`

- Amplía roles en `portal_accesos` (incluye `aduanera` legacy).
- Crea `portal_login_logs` y `vehiculo_compartidos`.
- RLS: `portal_login_logs` → **solo `service_role`** (sin políticas para `authenticated`).
- `vehiculo_compartidos` → SELECT propio + service_role.
- **No** toca políticas de escritura de `vehiculos`.

### Complemento (este PR): `20260810120000_vehiculos_rls_taller_mutations.sql`

- INSERT/UPDATE/DELETE de `vehiculos` para `authenticated` si `taller_id = get_my_taller_id()`.
- Defensa si se usa cliente de usuario; las actions PL con admin **siguen saltando RLS**.

Leer ambas: la primera = roles/logs; la segunda = RLS de mutación en `vehiculos`.

---

## 5. Dashboard + planilla (buckets e impronta)

### Buckets — `app/importacion/(modulo)/page.tsx`

Ya alineados a `planillaFase` (no hay dashboard “viejo” desconectado):

| Label UI | Condición |
|----------|-----------|
| Por cargar docs de embarque | `fase === 1` && sin `fechaIngreso` |
| Por recibir en puerto | sin ingreso && (`fase` null \|\| `2`) |
| Pendiente a completar | `fase` null \|\| `< 7` |
| Por presentación SENIAT | `esProximoSeniat` |
| Por nacionalizar | `esProximoNacionalizar` (+ `diasHasta` plazo 3 años, UI pasiva) |

### Forzar impronta — `components/nfc/PlanillaRegistroImportacion.tsx` (`Fase2Llegada`)

- Checkbox si hay foto y estado `no_leido` o `null`.
- Sin filtro por rol portal.
- Envía `forzarImprontaSinVerificar` a la action del §2.

---

## Limitaciones conocidas (fuera de estos 5 puntos)

1. Sin estado SENIAT `rechazada` / flujo de corrección.
2. Sin alertas/cron para `fechaLimiteNacionalizacion` ni `seguro.vigenciaHasta` (solo bucket UI para nacionalizar).
3. `numeroExpediente` eliminado; correlativo N se deriva de `codigoExpediente`.

Contexto completo: `docs/PUERTO-LIBRE-CONTEXT.md`.
