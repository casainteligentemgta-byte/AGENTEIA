# SmartTaller

Gestión de mantenimientos para talleres vía Telegram.

## Deploy en Vercel

| Setting | Valor |
|---------|--------|
| **Root Directory** | `apps/smartaller` |
| **Framework** | Next.js |

### Environment Variables

```
TELEGRAM_BOT_TOKEN
TELEGRAM_WEBHOOK_SECRET
OPENAI_API_KEY
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
CALLMEBOT_API_KEY   (opcional)
```

### Webhook Telegram

```bash
curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<TU-DOMINIO>/api/telegram-webhook&secret_token=<SECRET>"
```

## Local

```bash
npm install
npm run dev
```

Puerto: http://localhost:3003
