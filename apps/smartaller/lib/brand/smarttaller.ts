import { DEFAULT_MAINTENANCE_SCHEDULE } from "@/lib/brand/defaults";
import { smarttallerTelegramCopy } from "@/lib/brand/telegram-copy";
import type { BrandConfig } from "@/lib/brand/types";

export const SMARTTALLER_BRAND: BrandConfig = {
  id: "smarttaller",
  productionHost: "smarttaller.xyz",
  theme: {
    mode: "color",
    colors: {
      primary: "#0d9488",
      primaryHover: "#0f766e",
      primaryLight: "#14b8a6",
      primaryMuted: "#2dd4bf",
      primaryDark: "#115e59",
      accent: "#f97316",
      dark: "#0b1220",
      darkSurface: "#0f1a2e",
      themeColor: "#0d9488",
    },
  },
  assets: {
    logoOnLight: "/icon.svg",
    logoOnDark: "/icon.svg",
    favicon: "/icon.svg",
    appleIcon: "/icon.svg",
  },
  copy: {
    name: "SmartTaller",
    wordmark: { prefix: "Smart", suffix: "Taller" },
    tagline: "Gestión inteligente de talleres",
    proName: "SmartTaller Pro",
    assistantName: "Smartaller",
    chatName: "Chat Smartaller",
    metaTitle: "SmartTaller — Gestión inteligente de talleres",
    metaDescription:
      "Registra mantenimientos vehiculares con IA. Envía fotos de facturas por Telegram y gestiona tu taller desde un dashboard moderno.",
    appleWebAppTitle: "SmartTaller",
    appTitle: "SmartTaller — Tu vehículo",
    pwaName: "SmartTaller",
    pwaShortName: "SmartTaller",
    pwaDescription: "Gestión inteligente de mantenimientos vehiculares",
    fallbackTallerNombre: "SmartTaller",
    emailFromName: "SmartTaller",
    emailFromFallback: "SmartTaller <onboarding@resend.dev>",
    emailFooter: "SmartTaller",
    recordatorioLinkLabel: "Ver historial en SmartTaller",
    whatsappReclamoLine: "Reclama el historial en SmartTaller:",
    paywallBody:
      "Lleva el control de tus vehículos de forma independiente: historial, recordatorios y Chat Smartaller, sin depender de un taller vinculado.",
    subscriptionActivated:
      "¡Suscripción activada! Ya puedes registrar vehículos y usar SmartTaller Pro.",
    needProVehicles:
      "Necesitas SmartTaller Pro ($2.99/mes) para registrar vehículos de forma independiente.",
    needProMantenimientos: "Necesitas SmartTaller Pro para registrar mantenimientos.",
    needProCategorias: "Necesitas SmartTaller Pro para actualizar categorías.",
    needProEstado: "Necesitas SmartTaller Pro para actualizar el estado.",
    needProChat: "Activa SmartTaller Pro para registrar mantenimientos y usar Chat Smartaller.",
    loginTallerSubtitle: "Accede a los portales (taller, aduana, master…)",
    loginDuenoSubtitle: "Accede a tu app de vehículos",
    loginTallerCta: "Entrar a portales",
    loginDuenoCta: "Entrar a la app",
    portalesNavLabel: "Portales",
    portalesBackLabel: "Volver a portales",
    portalesHomeLink: "Ir a portales",
    landing: {
      homeTitle: "SmartTaller · Una foto a la placa. El resto lo hace SmartTaller.",
      homeDescription:
        "La IA reconoce el vehículo y abre la orden. Gestión de talleres para autos, motos, bicis y maquinaria.",
      heroAccent: "El resto lo hace SmartTaller.",
      headerAria: "SmartTaller, inicio",
      demoAria:
        "Ejemplo: se envía la foto de la placa ABC-123 por Telegram, SmartTaller reconoce un Toyota Hilux 2019 y crea la orden 0482.",
      demoBot: "Telegram · SmartTaller Bot",
      demoVehicle: "Toyota Hilux 2019",
      demoWhatsApp:
        "Así se verá el aviso cuando activemos WhatsApp: «Hola Carlos, tu Hilux ya está en el taller.»",
      stepsWho: "SmartTaller",
      footerCredit: "SmartTaller",
      paraTalleresTitle: "Para talleres — SmartTaller",
      howItWorksDesc:
        "SmartTaller entra en acción: la IA lee la placa en segundos, identifica el vehículo y extrae los datos clave. Adiós al registro manual y a los errores de dedo.",
      howItWorksWhy: "¿Por qué cambia el juego con SmartTaller?",
      aboutP1:
        "En SmartTaller creemos que la gestión de un taller mecánico y el control de las reparaciones no debería ser complicado. Por eso desarrollamos una plataforma pensada para simplificar la administración de tu negocio y la comunicación con tus clientes, combinando tecnología en la nube, control de procesos y facilidad de uso.",
      aboutP4:
        "Con SmartTaller, acompañamos el crecimiento de tu negocio paso a paso, dándote herramientas eficientes para optimizar tus tiempos, tomar mejores decisiones y garantizar que el servicio a tus clientes sea más rápido, transparente y profesional.",
      b2bHero:
        "El mecánico escanea el vehículo al llegar. SmartTaller registra la orden, actualiza la flota, avisa al cliente y deja todo visible en tu dashboard — auto, moto, bici o maquinaria.",
      homeHero:
        "Desde que el vehículo ingresa y es escaneado, SmartTaller automatiza todo: registra la orden, actualiza el inventario de la flota y notifica al cliente en tiempo real. Controla autos, motos, bicis o maquinaria desde un solo dashboard centralizado.",
    },
    telegram: smarttallerTelegramCopy(),
  },
  vehicleCatalog: {
    locked: false,
    lockedMarca: null,
    modelsProvisional: false,
    models: [],
  },
  maintenance: DEFAULT_MAINTENANCE_SCHEDULE,
};
