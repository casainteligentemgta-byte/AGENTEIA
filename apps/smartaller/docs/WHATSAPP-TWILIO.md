# WhatsApp con Twilio — SmartTaller

SmartTaller envía WhatsApp **solo si lo activas**. Por defecto el canal está apagado (`WHATSAPP_ENABLED` no vale `true`): los crons, el health check y el procesamiento de facturas siguen funcionando y **no lanzan error**.

Implementación: `lib/whatsapp.ts` (REST de Twilio, sin SDK). Prefijo telefónico por defecto: **58 (Venezuela)**.

---

## 1. Crear una cuenta trial de Twilio

1. Entra a [https://www.twilio.com/try-twilio](https://www.twilio.com/try-twilio) y crea la cuenta.
2. Verifica el correo y el teléfono.
3. En la consola, copia:
   - **Account SID** (`AC…`) → `TWILIO_ACCOUNT_SID`
   - **Auth Token** → `TWILIO_AUTH_TOKEN`  
     (Console → Account → API keys & tokens. El Auth Token es secreto: no lo pongas en el cliente ni en git.)
4. El trial alcanza para el sandbox de WhatsApp. Para producción hace falta un número WhatsApp Business aprobado (Twilio + Meta).

---

## 2. Sandbox de WhatsApp (pruebas)

En la consola: **Messaging → Try it out → Send a WhatsApp message**.

Datos típicos del sandbox:

| Campo | Valor de ejemplo |
|-------|------------------|
| Número sandbox | `+1 415 523 8886` |
| `TWILIO_WHATSAPP_FROM` | `whatsapp:+14155238886` |
| Código de unión | `join <palabra-sandbox>` (lo muestra la consola; cambia por cuenta) |

**Cómo unirte (obligatorio en trial):**

1. Abre WhatsApp en el celular que va a **recibir** los mensajes.
2. Envía al `+1 415 523 8886` el texto exacto `join …` que te da Twilio.
3. Twilio responde confirmando. Ese número ya puede recibir mensajes del sandbox.
4. Cada destinatario de prueba debe hacer el `join`. El sandbox no escribe a números que no se hayan unido.

En sandbox puedes mandar texto libre (`Body`). Fuera del sandbox (producción) Meta exige **plantillas** aprobadas para el primer mensaje de una conversación.

---

## 3. Variables de entorno

Root Directory en Vercel: `apps/smartaller`. Redeploy después de guardar.

```env
# Kill switch. Debe ser exactamente true (minúsculas). Cualquier otro valor omite el envío.
WHATSAPP_ENABLED=true

TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886

# Opcionales: ContentSid de plantillas Utility ya aprobadas en Meta/Twilio
TWILIO_CONTENT_SID_RECORDATORIO=HXxxxxxxxx
TWILIO_CONTENT_SID_CONFIRMACION=HXxxxxxxxx
TWILIO_CONTENT_SID_PAGO=HXxxxxxxxx
```

| Variable | Obligatoria para enviar | Uso |
|----------|-------------------------|-----|
| `WHATSAPP_ENABLED` | Sí (`true`) | Kill switch. Si falta o no es `true`, se registra `whatsapp disabled` y se devuelve `{ ok: false, skipped: true }`. |
| `TWILIO_ACCOUNT_SID` | Sí | Account SID de Twilio. |
| `TWILIO_AUTH_TOKEN` | Sí | Auth Token (servidor únicamente). |
| `TWILIO_WHATSAPP_FROM` | Sí | Remitente `whatsapp:+…` (sandbox o número aprobado). |
| `TWILIO_CONTENT_SID_RECORDATORIO` | No | Plantilla de recordatorio de mantenimiento. |
| `TWILIO_CONTENT_SID_CONFIRMACION` | No | Plantilla de confirmación al procesar factura. |
| `TWILIO_CONTENT_SID_PAGO` | No | Plantilla de aviso de pago / vencimiento de suscripción. |

Si `WHATSAPP_ENABLED=true` pero falta alguna credencial, **tampoco se envía** (mismo `skipped`). El health (`/api/health` con `Authorization: Bearer $CRON_SECRET`) reporta `whatsapp: skipped` cuando está apagado o incompleto, y `ok` solo si puede enviar. **Nunca `error`**, para no tumbar el health.

---

## 4. Cómo activar (y cómo dejarlo dormido)

**Dejarlo apagado (recomendado hasta tener sandbox o plantillas):** no definas `WHATSAPP_ENABLED`, o pon cualquier valor distinto de `true`. No hace falta borrar las credenciales Twilio.

**Activar:**

1. Configura SID, token y `TWILIO_WHATSAPP_FROM`.
2. En sandbox: une al menos un número de prueba con `join …`.
3. Pon `WHATSAPP_ENABLED=true`.
4. Redeploy.
5. Comprueba `/api/health` (detalle con `CRON_SECRET`): `checks.whatsapp` debe ser `ok`.
6. Dispara un recordatorio de prueba o procesa una factura con teléfono `0414…`.

**Apagar de urgencia:** cambia `WHATSAPP_ENABLED` a `false` (o bórrala) y redeploy. Los crons no fallan.

---

## 5. Plantillas Meta (categoría Utility)

En producción, el primer mensaje al cliente debe ser una **plantilla aprobada**. Categoría recomendada: **Utility** (recordatorios transaccionales, no marketing).

En Twilio: **Content Template Builder** (o Messaging → Content). Crea plantillas en español, envíalas a Meta y, al aprobarlas, copia el **Content SID** (`HX…`) a la variable que corresponda.

Los placeholders son `{{1}}`, `{{2}}`, … y se envían como `ContentVariables` JSON (`{"1":"Ana","2":"ABC123",…}`).

### Sugerencias de texto (Utility)

**Recordatorio de mantenimiento** → `TWILIO_CONTENT_SID_RECORDATORIO`

> Hola {{1}}, te recordamos el mantenimiento de tu vehículo {{2}}. Fecha recomendada: {{3}}{{4}}. Consulta tu historial: {{5}}

| Variable | Contenido |
|----------|-----------|
| `{{1}}` | Nombre del cliente |
| `{{2}}` | Placa |
| `{{3}}` | Fecha programada |
| `{{4}}` | Texto extra de km (o vacío) |
| `{{5}}` | URL del portal |

**Confirmación de factura / registro** → `TWILIO_CONTENT_SID_CONFIRMACION`

> Hola {{1}}, tu vehículo {{2}} ha sido registrado en el taller. Tu próximo servicio está programado para el {{3}}. Historial: {{4}}

| Variable | Contenido |
|----------|-----------|
| `{{1}}` | Nombre |
| `{{2}}` | Placa |
| `{{3}}` | Fecha del próximo servicio |
| `{{4}}` | URL del portal |

**Aviso de pago / vencimiento de suscripción** → `TWILIO_CONTENT_SID_PAGO`

> Hola {{1}}, tu suscripción SmartTaller vence en {{2}} día(s) ({{3}}). Renueva con Pago Móvil para no perder el acceso: {{4}}

| Variable | Contenido |
|----------|-----------|
| `{{1}}` | Nombre o taller |
| `{{2}}` | Días restantes (7 o 3) |
| `{{3}}` | Fecha de vencimiento |
| `{{4}}` | URL de renovación (`/app` o `/dashboard`) |

Consejos para la aprobación de Meta:

- Idioma: **Spanish**.
- Categoría: **Utility** (no Marketing).
- Sin promociones, cupones ni “ofertas”.
- Nombre del negocio reconocible (SmartTaller).
- Botones opcionales de tipo URL si Meta los pide; si no, deja el enlace en el cuerpo.

Si **no** hay `TWILIO_CONTENT_SID_*`, se envía el texto libre (`Body`). Sirve en sandbox; en un número de producción Meta puede rechazar mensajes de sesión fuera de las 24 h.

---

## 6. Números venezolanos

`normalizeTelefono()` convierte a dígitos internacionales **sin** `+` y antepone **58** si hace falta:

| Entrada | Resultado |
|---------|-----------|
| `04141234567` | `584141234567` |
| `4141234567` | `584141234567` |
| `+58 414 1234567` | `584141234567` |
| `584141234567` | `584141234567` |
| `+58 0414 1234567` | `584141234567` (quita el 0 de tronco) |

Twilio recibe `whatsapp:+584141234567`.

---

## 7. Dónde se usa

| Flujo | Archivo | Tipo de plantilla |
|-------|---------|-------------------|
| Cron de recordatorios de mantenimiento | `lib/recordatorios.ts` ← `/api/cron/recordatorios` | `recordatorio` |
| Confirmación al procesar factura | `lib/process-invoice.ts` | `confirmacion` |
| Aviso de vencimiento de suscripción | `lib/billing/recordatorios-suscripcion.ts` ← `/api/cron/suscripciones` | `pago` (solo si el canal está activo y hay teléfono) |

El cron de suscripciones **ya avisa in-app** (y Telegram al taller). WhatsApp es un extra: si está apagado, no busca teléfonos ni falla.

El enlace `wa.me` del dashboard (`waMeHref`) no pasa por Twilio: abre WhatsApp en el navegador del taller.

---

## 8. Paso a producción (número propio)

1. En Twilio, compra o registra un número con WhatsApp.
2. Completa el perfil de WhatsApp Business y eligibilidad de Meta.
3. Envía las tres plantillas Utility y espera la aprobación.
4. Cambia `TWILIO_WHATSAPP_FROM` al número de producción (`whatsapp:+58…` o el que asigne Twilio).
5. Pon los tres `TWILIO_CONTENT_SID_*`.
6. Mantén `WHATSAPP_ENABLED=true` solo cuando las plantillas estén Approved.

Documentación Twilio: [WhatsApp](https://www.twilio.com/docs/whatsapp) · [Content API](https://www.twilio.com/docs/content).
