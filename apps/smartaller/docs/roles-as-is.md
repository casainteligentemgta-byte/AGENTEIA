# AS-IS: roles, flags, rutas y queries

Inventario real del codigo. No hay tabla de permisos ni de operadores. No hay checkPermisos. No hay /api/talleres ni /api/operadores ni /api/usuarios ni /api/vehiculos.

Fuente canonica de migraciones: apps/smartaller/supabase/migrations/
apps/importacion no tiene migraciones; duplica lib/ y actions.

---

## 1. MODELOS DE BD

### 1.1 users / roles

Identidad: auth.users (Supabase Auth). No hay tabla custom de usuarios.

Tabla public.portal_accesos (1 fila por user_id)
Creada: 20260806180000_portal_accesos.sql
CHECK actual: 20260809120000_importacion_roles_login_logs.sql
Aislamiento: 20260810140000_portal_aislamiento.sql

Columnas:
- user_id uuid PK -> auth.users
- roles text[] default {}
- ver_todo boolean default false
- taller_ids uuid[] default {}
- org_nombre text
- notas text
- created_at, updated_at
- aislado_at timestamptz
- aislado_por uuid -> auth.users

CHECK roles validos:
master, admin, aduanera, taller, concesionario, usuario

RLS: ON
- portal_accesos select own: authenticated, user_id = auth.uid()
- portal_accesos all service role: ALL true
Sin INSERT/UPDATE/DELETE para authenticated. Mutaciones via service_role (Server Actions).

Tabla public.perfiles (B2C plan/stripe, NO es rol de portal)
id = auth.users.id, tipo_plan free|premium, suscripcion_activa, vencimiento_plan, stripe_*

### 1.2 talleres (tipo_industria)

Tabla public.talleres
Create: 20250704100000_multi_taller.sql
tipo_industria: 20250704150000_plataforma_hibrida.sql
preferencias: 20260806170000_talleres_preferencias.sql
aislado: 20260810140000_portal_aislamiento.sql

Columnas clave:
- id uuid PK
- nombre
- owner_user_id uuid UNIQUE -> auth.users  (UN TALLER POR OWNER)
- telegram_chat_id bigint unique nullable
- codigo_vinculo text unique
- tipo_industria enum: concesionario | bicicletas | constructora  default concesionario
- preferencias jsonb
- aislado_at, aislado_por

NO es un rol de persona. Es el tipo de negocio del taller.

Funcion SQL get_my_taller_id():
select id from talleres where owner_user_id = auth.uid() and aislado_at is null limit 1

RLS talleres: select/insert/update own (owner_user_id = auth.uid()) + service_role ALL + select extra si el user tiene mantenimientos en vehiculos de ese taller.
Sin DELETE authenticated.

### 1.3 permisos / capabilities

NO EXISTE tabla permisos, capabilities, user_permissions, role_permissions.

Capabilities = columnas de portal_accesos + funciones TS en:
- lib/portal/roles.ts
- lib/importacion/access.ts

### 1.4 taller_operadores o similar

NO EXISTE taller_operadores, taller_miembros, taller_usuarios, workshop_members.

Modelo actual: 1 owner por taller (unique owner_user_id).
Alcance extra de otros talleres: portal_accesos.taller_ids[] (array, no tabla de miembros).

vehiculo_compartidos NO es operador: es compartir un vehiculo con un usuario final.

### 1.5 audit / logs de auth

Tabla public.portal_login_logs
20260809120000_importacion_roles_login_logs.sql
NO esta en setup-completo.sql

Columnas: id, user_id, email, roles text[], path, user_agent, created_at

RLS ON, SOLO policy service_role ALL.
Sin policies authenticated. Lectura solo master+ver_todo via admin client
(app/actions/portal-login.ts).

No hay auth_logs, session_logs ni audit de cambios de rol.

---

## 2. CODIGO DE AUTENTICACION

Tres capas. No hay checkPermisos. No hay getSession. Patron: getUser() = supabase.auth.getUser().

### 2.1 middleware (solo sesion, SIN roles)

apps/smartaller/middleware.ts
-> lib/supabase/middleware.ts updateSession()

Protege paths: /dashboard, /app, /smartimport, /portales
Sin user -> redirect /login o /smartimport/login
NO lee portal_accesos. NO evalua ver_todo ni roles.

apps/importacion/middleware.ts: solo /smartimport.

### 2.2 resolucion de acceso (inferencia de rol)

lib/portal/roles.ts  resolvePortalAccess()
Lee:
- portal_accesos: roles, ver_todo, taller_ids, org_nombre, aislado_at
- talleres: owner_user_id, tipo_industria, aislado_at
- vehiculos: count where user_id = yo

Inferencia:
- owner de taller no aislado -> push rol taller + id en tallerIds
- si tipo_industria = concesionario -> TAMBIEN push rol concesionario
- si tiene vehiculos o es autenticado -> push usuario (TODO login es usuario)
- si portal_accesos.aislado_at != null -> roles=[], verTodo=false, tallerIds=[], sin inferencia

Duplicado casi identico en apps/importacion/lib/portal/roles.ts

### 2.3 check de permisos (equivalentes a checkPermisos)

NO existe checkPermisos.

Gates reales:
- hasPortalRole(access, role)
  master tambien pasa como admin y aduanera
- requirePortalRole(access, role)
  para master/admin/aduanera FALLA si !verTodo && tallerIds.length===0
- canAccessImportacion
- isMasterAdmin = master AND verTodo
- isDataAdmin = admin AND (verTodo OR tallerIds)
- canAccessAllImportacionData = master/admin/aduanera + verTodo
- canMutateImportacionData
  master/admin ok; aduanera+verTodo = false (solo lectura);
  taller/concesionario solo si tallerIds.length > 0
- canViewLoginLogs = isMasterAdmin
- canForzarImprontaSinVerificar = alias de canMutateImportacionData
- isImportacionUsuarioOnly
- resolveVisibleTallerIds
- resolveImportacionTallerScope  (definida, SIN consumidores fuera de access.ts)

Archivo: lib/importacion/access.ts (duplicado en apps/importacion)

### 2.4 logica de ver_todo

Columna portal_accesos.ver_todo -> access.verTodo

Efectos:
- isMasterAdmin requiere verTodo
- vision global de data: master/admin/aduanera + verTodo
- requirePortalRole bloquea master/admin/aduanera sin verTodo y sin taller_ids
- portal-master.ts: aislar/borrar SOLO si verTodo
- canViewLoginLogs solo si verTodo
- hub /portales: botones privilegiados blocked sin alcance
- aduanera + verTodo puede VER todo pero NO mutar

### 2.5 taller_ids

Columna portal_accesos.taller_ids uuid[] -> access.tallerIds
Se complementa con tallerPropio.id si soy owner.

Uso:
- resolveVisibleTallerIds: si no verTodo, filtra .in(id, tallerIds) o .in(taller_id, tallerIds)
- operador (taller/concesionario): SIEMPRE acotado a esos ids
- usuario: NO usa taller_ids; usa vehiculos.user_id + vehiculo_compartidos

### 2.6 segundo gate (ownership de taller, no roles)

lib/importacion/taller-auth.ts  (SOLO apps/smartaller; NO existe en importacion)
- requireTallerAuth: getUser + ensureTallerForUser (PUEDE CREAR taller)
- assertVehiculoTaller: vehiculo.taller_id === tallerId

Muchas actions NFC copian este patron localmente (getUser + getMyTaller)
en vez de importar taller-auth.ts. No leen portal_accesos.

packages/smart-import tiene auth Express AJENA (Bearer + tabla users.role admin|user).
No esta conectada al portal.

---

## 3. RUTAS PROTEGIDAS

No hay REST /api/talleres* /api/operadores* /api/usuarios* /api/vehiculos*.
Next.js App Router + Server Actions.

### Equivalentes

Talleres:
- lib/taller.ts (ensureTallerForUser, getMyTaller)
- app/actions/taller.ts
- app/actions/portal.ts listPortalTalleresAction
- app/actions/portal-master.ts aislar/borrar

Operadores:
- no hay entidad. Son roles en portal_accesos.roles + inferencia

Usuarios:
- auth.users + portal_accesos
- portal-master.ts listMasterPortalUsersAction
- app/app/* B2C (vehiculos.user_id)

Vehiculos:
- app/actions/vehiculos.ts, vehicles.ts
- app/actions/nfc/importacion-vehiculo.ts
- app/actions/portal.ts listPortalVehiculosAction
- lib/data/user-vehicles.ts

### Pages que SI chequean rol

/portales                          getUser + resolvePortalAccess + hasPortalRole (hub)
/portales/master                   requirePortalRole master
/portales/aduanera                 requirePortalRole aduanera
/portales/concesionario            requirePortalRole concesionario
NO existe /portales/taller         el taller va a /dashboard

/smartimport/(modulo)/*            layout: getUser + canAccessImportacion
/smartimport/(modulo)/admin/ingresos   canViewLoginLogs (master+verTodo)
/smartimport/(modulo)/page.tsx     carga vehiculos segun rol (all / taller_ids / usuario)
/smartimport/(modulo)/[vehiculoId] canMutateImportacionData para UI

/dashboard/*                       sesion + ensureTallerForUser. SIN gate de rol portal.
/app/*                             sesion + vehiculos.user_id (B2C)

### API routes existentes (no CRUD de roles)

/api/chat                    getUser + getMyTaller
/api/nfc/hash-pin            getUser
/api/nfc/download            getUser + getMyTaller + eq taller_id
/api/smartimport/ocr-*       getUser dentro de la action
/api/cron/*                  CRON_SECRET
/api/health                  publico
/api/telegram-webhook        bot
/api/stripe/webhook          stripe
/api/strava/webhook          strava

### Server Actions con roles

app/actions/portal.ts              requirePortalRole + resolveVisibleTallerIds
app/actions/portal-master.ts       master + verTodo
app/actions/portal-login.ts        canViewLoginLogs
app/actions/vehiculo-compartidos.ts  isMasterAdmin / isDataAdmin
app/actions/nfc/importacion-vehiculo.ts  requireTallerAuth + canMutateImportacionData

---

## 4. QUERIES DE BD

### 4.1 where taller_id

Patron TS:
- Portal listados: .in("taller_id", scope.ids) o sin filtro si scope.all
- Puerto Libre: .eq("taller_id", auth.taller.id)
- Mutaciones NFC: assertVehiculoTaller o .eq("taller_id", tallerId)
- Dashboard: get_my_taller_id() via RLS o .eq("taller_id", taller.id)
- Master delete: .eq("taller_id", id) en cascada
- B2C usuario: .eq("user_id", user.id)  -- NO usa taller_id

### 4.2 where ver_todo

No se filtra en SQL con WHERE ver_todo.
Se lee una vez en resolvePortalAccess y se aplica en TS:
si verTodo -> no filtrar por taller_id
si no -> .in("taller_id", tallerIds)

### 4.3 permisos por rol (runtime TS, no SQL)

master + ver_todo: ver/mutar todo, logs, aislar/borrar
admin + ver_todo o taller_ids: ver/mutar data, sin logs
aduanera + ver_todo: ver todo, NO mutar
taller / concesionario + taller_ids: ver/mutar solo sus clientes
usuario: ver propios + compartidos, NO mutar

### 4.4 RLS (capa paralela; actions PL la saltan con admin client)

vehiculos:
- select/insert/update/delete own taller: taller_id = get_my_taller_id()
- select/insert/update/delete own user: user_id = auth.uid()
- all service_role true

talleres: owner_user_id = auth.uid() + service_role
portal_accesos: select own + service_role
portal_login_logs: SOLO service_role
vehiculo_compartidos: select own + service_role
importadores, nfc_stickers, biblioteca_legal_documentos, llm_usage, repuestos:
  taller_id = get_my_taller_id() + service_role
mantenimientos / recordatorios / ordenes_recepcion: mix taller + owner vehiculo

Importante: las Server Actions de Puerto Libre usan createAdminClient() y SALTAN RLS.
El ownership lo hace requireTallerAuth / assertVehiculoTaller en aplicacion.

---

## Huecos vs el arbol pedido

checkPermisos          NO existe. Usar access.ts + requirePortalRole.
taller_operadores      NO existe. Un owner por taller + taller_ids[].
tabla permisos         NO existe. Flags en portal_accesos + helpers TS.
/api/talleres*         NO existe. Server Actions + pages.
/api/operadores*       NO existe.
/api/usuarios*         NO existe.
/api/vehiculos*        NO existe. actions/vehiculos.ts y nfc/importacion-vehiculo.ts.
WHERE ver_todo en SQL  NO existe. Flag leido en TS.
middleware de roles    NO existe. Middleware solo sesion.

Dos sistemas en paralelo:
1) portal_accesos (roles + ver_todo + taller_ids) para UI/portales/listados
2) requireTallerAuth / get_my_taller_id() para mutaciones de taller y RLS
