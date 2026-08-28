// Prod verde — SmartTaller
// Pegar en Scriptable (iOS). Widget pequeño o Run Script.
// Verde = Vercel producción de main OK y https://smarttaller.xyz/api/health ok.
// Si /api/health trae sha, también tiene que coincidir con main.

const REPO = "casainteligentemgta-byte/AGENTEIA";
const HEALTH_URL = "https://smarttaller.xyz/api/health";
const SITE_URL = "https://smarttaller.xyz";
const VERCEL_CONTEXT = "Vercel – smartaller";

async function loadJson(url) {
  const req = new Request(url);
  req.headers = {
    Accept: "application/json",
    "User-Agent": "scriptable-prod-verde",
  };
  req.timeoutInterval = 20;
  return req.loadJSON();
}

function shortSha(sha) {
  return String(sha || "").replace(/^sha/, "").slice(0, 7);
}

function vercelStatus(payload) {
  const list = Array.isArray(payload.statuses) ? payload.statuses : [];
  const hit = list.find((s) => s.context === VERCEL_CONTEXT);
  return {
    state: hit ? String(hit.state) : String(payload.state || "pending"),
    description: hit ? String(hit.description || "") : "",
    url: hit && hit.target_url ? String(hit.target_url) : "",
  };
}

async function readProd() {
  const [status, health] = await Promise.all([
    loadJson(`https://api.github.com/repos/${REPO}/commits/main/status`),
    loadJson(HEALTH_URL).catch(() => null),
  ]);
  const vercel = vercelStatus(status);
  const mainSha = shortSha(status.sha);
  const liveSha = health && health.sha ? shortSha(health.sha) : "";
  const healthOk = Boolean(health && health.status === "ok");
  const shaMatch = !liveSha || liveSha === mainSha;
  const vercelOk = vercel.state === "success";
  const green = vercelOk && healthOk && shaMatch;

  let tone = "red";
  let title = "ROJO";
  let detail = vercel.description || "Vercel no está en verde";
  if (green) {
    tone = "green";
    title = "VERDE";
    detail = `Producción lista · ${liveSha || mainSha}`;
  } else if (vercel.state === "pending") {
    tone = "yellow";
    title = "AMARILLO";
    detail = vercel.description || "Vercel desplegando…";
  } else if (vercelOk && !healthOk) {
    detail = "Vercel OK, pero /api/health no responde ok";
  } else if (vercelOk && liveSha && liveSha !== mainSha) {
    detail = `Sitio en ${liveSha}, main es ${mainSha}. Cerrá la pestaña.`;
  }

  return {
    tone,
    title,
    detail,
    mainSha,
    liveSha,
    healthOk,
    vercel,
    openUrl: green ? SITE_URL : vercel.url || `https://github.com/${REPO}/commit/${status.sha || "main"}`,
  };
}

function toneColor(tone) {
  if (tone === "green") return new Color("#15803d");
  if (tone === "yellow") return new Color("#a16207");
  return new Color("#b91c1c");
}

function makeWidget(info) {
  const widget = new ListWidget();
  widget.backgroundColor = toneColor(info.tone);
  widget.setPadding(10, 12, 10, 12);
  widget.url = info.openUrl;

  const kicker = widget.addText("PROD");
  kicker.font = Font.boldSystemFont(11);
  kicker.textColor = Color.white();
  widget.addSpacer(4);
  const title = widget.addText(info.title);
  title.font = Font.boldSystemFont(22);
  title.textColor = Color.white();
  widget.addSpacer(4);
  const detail = widget.addText(info.detail);
  detail.font = Font.systemFont(11);
  detail.textColor = Color.white();
  detail.lineLimit = 3;
  return widget;
}

async function presentAlert(info) {
  const alert = new Alert();
  alert.title = `SmartTaller ${info.title}`;
  alert.message = [
    info.detail,
    `main ${info.mainSha || "—"}`,
    `live ${info.liveSha || "sin sha (deploy viejo)"}`,
    `health ${info.healthOk ? "ok" : "no"}`,
    `vercel ${info.vercel.state}`,
  ].join("\n");
  alert.addAction("Abrir");
  alert.addCancelAction("Cerrar");
  const idx = await alert.presentAlert();
  if (idx === 0) Safari.open(info.openUrl);
}

const info = await readProd();
if (config.runsInWidget) {
  Script.setWidget(makeWidget(info));
} else {
  await presentAlert(info);
}
Script.complete();
