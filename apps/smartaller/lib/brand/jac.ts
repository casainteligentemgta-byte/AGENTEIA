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
      mode: "photo",
      colors: {
        primary: "#1c1c22",
        primaryHover: "#111116",
        primaryLight: "#3a3a44",
        primaryMuted: "#5b5b66",
        primaryDark: "#111116",
        accent: "#3b5bdb",
        dark: "#1c1c22",
        darkSurface: "#ffffff",
        themeColor: "#f3f4f8",
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
      tagline: "El cuidado de su JAC, con el respaldo de la marca",
      proName: `${JAC_NAME} Pro`,
      assistantName: "Asistente JAC",
      chatName: "Chat JAC",
      metaTitle: `${JAC_NAME} — El cuidado de su JAC`,
      metaDescription:
        "Consulte el estado de su JAC, gestione citas y el taller autorizado. Acceda con su correo electrónico.",
      appleWebAppTitle: JAC_NAME,
      appTitle: `${JAC_NAME} — Su vehículo`,
      pwaName: JAC_NAME,
      pwaShortName: "JAC Taller",
      pwaDescription: "El cuidado de su JAC, con el respaldo de la marca",
      fallbackTallerNombre: JAC_NAME,
      emailFromName: JAC_NAME,
      emailFromFallback: `${JAC_NAME} <onboarding@resend.dev>`,
      emailFooter: JAC_NAME,
      recordatorioLinkLabel: "Consultar el historial en JAC Taller",
      whatsappReclamoLine: "Consulte el historial en JAC Taller:",
      paywallBody:
        "Conserve el historial, los recordatorios y Chat JAC de sus vehículos, con independencia del taller.",
      subscriptionActivated:
        "Su suscripción está activa. Ya puede registrar sus JAC y utilizar JAC Taller Pro.",
      needProVehicles:
        "Para registrar vehículos de forma independiente se requiere JAC Taller Pro ($2.99/mes).",
      needProMantenimientos: "Para registrar mantenimientos se requiere JAC Taller Pro.",
      needProCategorias: "Para actualizar las categorías se requiere JAC Taller Pro.",
      needProEstado: "Para actualizar el estado se requiere JAC Taller Pro.",
      needProChat: "Active JAC Taller Pro para registrar mantenimientos y utilizar Chat JAC.",
      loginTallerSubtitle: "Acceda a la agenda del taller.",
      loginDuenoSubtitle: "Consulte el estado de su vehículo.",
      loginTallerCta: "Iniciar sesión",
      loginDuenoCta: "Iniciar sesión",
      portalesNavLabel: "Inicio",
      portalesBackLabel: "Volver al inicio",
      portalesHomeLink: "Ir al inicio",
      status: {
        bien: "En orden",
        atencion: "Próximo",
        critico: "Requiere atención",
        sinDatos: "Sin registro",
      },
      categories: {
        aceite: "Aceite",
        neumaticos: "Neumáticos",
        frenos: "Frenos",
        bateria: "Batería",
        alineacion: "Alineación",
        fluidos: "Fluidos",
        general: "Revisión general",
      },
      loginScreen: {
        title: "Bienvenido a JAC Taller",
        subtitle: "El cuidado de su JAC, con el respaldo de la marca.",
        ownerTab: "Propietario",
        workshopTab: "Taller",
        emailLabel: "Correo electrónico",
        passwordLabel: "Contraseña",
        submit: "Iniciar sesión",
        forgot: "¿Olvidó su contraseña?",
        signup: "Crear cuenta",
        signin: "Iniciar sesión",
        signupSuccess:
          "Cuenta creada. Revise su correo para confirmarla o inicie sesión.",
        authError: "No fue posible iniciar sesión. Verifique el correo y la contraseña.",
        google: "Continuar con Google",
        backHome: "Volver al inicio",
      },
      owner: {
        hello: (nombre, hour = 9) => {
          const saludo =
            hour < 12 ? "Buenos días" : hour < 19 ? "Buenas tardes" : "Buenas noches";
          const n = nombre.trim();
          return n ? `${saludo}, ${n}` : saludo;
        },
        statusTitle: (modelo, requiereAtencion) =>
          requiereAtencion
            ? `Su ${modelo} requiere atención`
            : `Su ${modelo} se encuentra al día`,
        servicesTitle: "Plan de mantenimiento",
        nextService: (kmLabel, fecha) => {
          if (kmLabel && fecha) return `Próximo servicio: ${kmLabel} o el ${fecha}.`;
          if (kmLabel) return `Próximo servicio: ${kmLabel}.`;
          if (fecha) return `Próximo servicio: ${fecha}.`;
          return "";
        },
        alertCauchos: "Le recomendamos programar la rotación de neumáticos.",
        alertNeumaticos: (km) =>
          `Le recomendamos programar la rotación de neumáticos en los próximos ${km.toLocaleString("es-VE")} km.`,
        citaTitle: "Próxima cita",
        citaDetail: (hora, servicio) => (servicio ? `${hora} · ${servicio}` : hora),
        moveCita: "Reprogramar",
        emptyVehicles: "Aún no ha registrado vehículos.",
        emptyHint: "Añada su JAC para comenzar.",
        addVehicle: "Añadir vehículo",
        tabInicio: "Inicio",
        tabCitas: "Citas",
        tabTaller: "Talleres",
        tabCuenta: "Cuenta",
        accountSignOut: "Cerrar sesión",
      },
      workshop: {
        today: "Agenda del día",
        kpiBahia: "En servicio",
        kpiCitas: "Por recibir",
        kpiConfirmar: "Por confirmar",
        chipBahia: "En servicio",
        chipEsperando: "En espera",
        chipConfirmada: "Confirmada",
        chipPorConfirmar: "Por confirmar",
        tableTitle: "Unidades del día",
        ownerPlate: (dueno, placa) => `${dueno} · ${placa}`,
      },
      vehicleForm: {
        typeLabel: "Tipo de vehículo",
        title: "Añadir un JAC",
        nick: "Alias",
        nickPlaceholder: "Ej. Tepuy familiar",
        color: "Color",
        colorPlaceholder: "Ej. Blanco",
        plate: "Placa",
        platePlaceholder: "Ej. AA90N90",
        odometerKm: "Kilometraje (opcional)",
        claimCode: "Código de vinculación del taller",
        claimHint: "Se lo proporciona recepción. No corresponde al código de Telegram.",
        cancel: "Cancelar",
        confirm: "Registrar",
        modelPlaceholder: "Seleccione el modelo",
        modelHint: "Catálogo de modelos JAC en Venezuela. Sujeto a confirmación.",
      },
      modeloRequired: "Seleccione el modelo de su JAC.",
      modeloInvalid: "Ese modelo no figura en el catálogo. Seleccione un nombre comercial válido.",
      landing: {
        homeTitle: `${JAC_NAME} · Una fotografía de la placa. Nos ocupamos del resto.`,
        homeDescription:
          "La inteligencia artificial identifica su JAC y abre la orden. Taller exclusivo de la marca.",
        heroAccent: "Nos ocupamos del resto.",
        headerAria: `${JAC_NAME}, inicio`,
        demoAria: `Ejemplo: se envía la fotografía de la placa ABC-123 por Telegram; ${JAC_NAME} identifica un Tepuy Pro y abre la orden 0482.`,
        demoBot: `Telegram · ${JAC_NAME} Bot`,
        demoVehicle: "JAC Tepuy Pro 2026",
        demoWhatsApp:
          "Así se verá el aviso cuando activemos WhatsApp: «Buenos días, Carlos. Su Tepuy ya se encuentra en el taller.»",
        stepsWho: JAC_NAME,
        footerCredit: JAC_NAME,
        paraTalleresTitle: `Para talleres — ${JAC_NAME}`,
        howItWorksDesc: `${JAC_NAME} lee la placa en segundos, identifica el JAC y registra los datos. Sin carga manual.`,
        howItWorksWhy: `¿Por qué ${JAC_NAME}?`,
        aboutP1: `En ${JAC_NAME} creemos que el cuidado de un JAC debe ser sencillo y preciso. Por ello concebimos una experiencia sobria para el taller y para usted.`,
        aboutP4: `Con ${JAC_NAME} su vehículo permanece al día y usted permanece informado.`,
        b2bHero: `El técnico registra el JAC a su llegada. ${JAC_NAME} abre la orden, actualiza la flota y notifica al propietario.`,
        homeHero: `Desde el ingreso y el registro, ${JAC_NAME} abre la orden y deja todo a la vista.`,
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
