import { DEFAULT_MAINTENANCE_SCHEDULE } from "@/lib/brand/defaults";
import { getJacModels } from "@/lib/brand/jac-models";
import { jacTelegramCopy } from "@/lib/brand/telegram-copy";
import type { BrandConfig } from "@/lib/brand/types";

const JAC_NAME = "JAC Taller";

export function buildJacBrand(): BrandConfig {
  return {
    id: "jac",
    productionHost: null,
    theme: {
      mode: "mono",
      colors: {
        primary: "#111111",
        primaryHover: "#000000",
        primaryLight: "#262626",
        primaryMuted: "#525252",
        primaryDark: "#000000",
        accent: "#ffffff",
        dark: "#000000",
        darkSurface: "#111111",
        themeColor: "#000000",
      },
    },
    assets: {
      logoOnLight: "/brands/jac/logo-negro.png",
      logoOnDark: "/brands/jac/logo-blanco.png",
      favicon: "/brands/jac/logo-negro.png",
      appleIcon: "/brands/jac/logo-negro.png",
    },
    copy: {
      name: JAC_NAME,
      tagline: "Mantenimiento exclusivo para vehículos JAC",
      proName: `${JAC_NAME} Pro`,
      assistantName: "Asistente JAC",
      chatName: "Chat JAC",
      metaTitle: `${JAC_NAME} — Mantenimiento exclusivo para vehículos JAC`,
      metaDescription:
        "Registra mantenimientos de vehículos JAC con IA. Envía fotos por Telegram y gestiona el taller desde un dashboard en blanco y negro.",
      appleWebAppTitle: JAC_NAME,
      appTitle: `${JAC_NAME} — Tu vehículo`,
      pwaName: JAC_NAME,
      pwaShortName: "JAC Taller",
      pwaDescription: "Mantenimiento exclusivo para vehículos JAC",
      fallbackTallerNombre: JAC_NAME,
      emailFromName: JAC_NAME,
      emailFromFallback: `${JAC_NAME} <onboarding@resend.dev>`,
      emailFooter: JAC_NAME,
      recordatorioLinkLabel: `Ver historial en ${JAC_NAME}`,
      whatsappReclamoLine: `Reclama el historial en ${JAC_NAME}:`,
      paywallBody:
        "Lleva el control de tus vehículos JAC de forma independiente: historial, recordatorios y Chat JAC, sin depender de un taller vinculado.",
      subscriptionActivated: `¡Suscripción activada! Ya puedes registrar vehículos y usar ${JAC_NAME} Pro.`,
      needProVehicles: `Necesitas ${JAC_NAME} Pro ($2.99/mes) para registrar vehículos de forma independiente.`,
      needProMantenimientos: `Necesitas ${JAC_NAME} Pro para registrar mantenimientos.`,
      needProCategorias: `Necesitas ${JAC_NAME} Pro para actualizar categorías.`,
      needProEstado: `Necesitas ${JAC_NAME} Pro para actualizar el estado.`,
      needProChat: `Activa ${JAC_NAME} Pro para registrar mantenimientos y usar Chat JAC.`,
      loginTallerSubtitle: "Mantenimiento de tu JAC",
      loginDuenoSubtitle: "Mantenimiento de tu JAC",
      loginTallerCta: "Entrar al taller",
      loginDuenoCta: "Entrar a la app",
      portalesNavLabel: "Inicio",
      portalesBackLabel: "Volver al inicio",
      portalesHomeLink: "Ir al inicio",
      landing: {
        homeTitle: `${JAC_NAME} · Una foto a la placa. El resto lo hace ${JAC_NAME}.`,
        homeDescription:
          "La IA reconoce el vehículo JAC y abre la orden. Gestión de talleres exclusiva para la marca.",
        heroAccent: `El resto lo hace ${JAC_NAME}.`,
        headerAria: `${JAC_NAME}, inicio`,
        demoAria: `Ejemplo: se envía la foto de la placa ABC-123 por Telegram, ${JAC_NAME} reconoce un JAC T8 2024 y crea la orden 0482.`,
        demoBot: `Telegram · ${JAC_NAME} Bot`,
        demoVehicle: "JAC T8 2024",
        demoWhatsApp:
          "Así se verá el aviso cuando activemos WhatsApp: «Hola Carlos, tu T8 ya está en el taller.»",
        stepsWho: JAC_NAME,
        footerCredit: JAC_NAME,
        paraTalleresTitle: `Para talleres — ${JAC_NAME}`,
        howItWorksDesc: `${JAC_NAME} entra en acción: la IA lee la placa en segundos, identifica el vehículo JAC y extrae los datos clave. Adiós al registro manual y a los errores de dedo.`,
        howItWorksWhy: `¿Por qué cambia el juego con ${JAC_NAME}?`,
        aboutP1: `En ${JAC_NAME} creemos que la gestión de un taller JAC y el control de las reparaciones no debería ser complicado. Por eso desarrollamos una plataforma pensada para simplificar la administración de tu negocio y la comunicación con tus clientes, combinando tecnología en la nube, control de procesos y facilidad de uso.`,
        aboutP4: `Con ${JAC_NAME}, acompañamos el crecimiento de tu negocio paso a paso, dándote herramientas eficientes para optimizar tus tiempos, tomar mejores decisiones y garantizar que el servicio a tus clientes sea más rápido, transparente y profesional.`,
        b2bHero: `El mecánico escanea el vehículo al llegar. ${JAC_NAME} registra la orden, actualiza la flota, avisa al cliente y deja todo visible en tu dashboard — exclusivo para vehículos JAC.`,
        homeHero: `Desde que el vehículo JAC ingresa y es escaneado, ${JAC_NAME} automatiza todo: registra la orden, actualiza el inventario de la flota y notifica al cliente en tiempo real. Controla tu taller autorizado desde un solo dashboard.`,
      },
      telegram: jacTelegramCopy(),
    },
    vehicleCatalog: {
      locked: true,
      lockedMarca: "JAC",
      modelsProvisional: true,
      models: getJacModels(),
    },
    maintenance: {
      ...DEFAULT_MAINTENANCE_SCHEDULE,
      source: "factory-pending",
      byModel: {},
    },
  };
}
