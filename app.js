"use strict";

/* =====================================================================
   Fournisseurs d'IA
   kind : format d'API ("anthropic", "gemini" ou "openai" = compatible OpenAI)
   caps : pièces jointes comprises (image, pdf, video, audio)
   ===================================================================== */
const PROVIDERS = {
  claude: {
    name: "Claude", color: "var(--claude)", kind: "anthropic", keyUrl: "https://console.anthropic.com/settings/keys",
    defaultModel: "claude-sonnet-5-5", models: ["claude-opus-5-5", "claude-sonnet-5-5", "claude-haiku-5-5"],
    caps: ["image", "pdf"],
  },
  openai: {
    name: "ChatGPT", color: "var(--openai)", kind: "openai", base: "https://api.openai.com/v1", keyUrl: "https://platform.openai.com/api-keys",
    defaultModel: "gpt-5", models: ["gpt-5", "gpt-5-mini", "gpt-4.1", "o3"],
    caps: ["image", "pdf"],
    imageGen: { defaultModel: "gpt-image-1", models: ["gpt-image-1", "dall-e-3"] },
  },
  gemini: {
    name: "Gemini", color: "var(--gemini)", kind: "gemini", keyUrl: "https://aistudio.google.com/apikey",
    defaultModel: "gemini-2.5-flash", models: ["gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.5-flash-lite"],
    caps: ["image", "pdf", "video", "audio", "youtube"],
    imageGen: { defaultModel: "gemini-2.5-flash-image", models: ["gemini-2.5-flash-image"] },
    videoGen: { defaultModel: "veo-3.0-fast-generate-001", models: ["veo-3.0-fast-generate-001", "veo-3.0-generate-001", "veo-2.0-generate-001"] },
  },
  grok: {
    name: "Grok", color: "var(--grok)", kind: "openai", base: "https://api.x.ai/v1", keyUrl: "https://console.x.ai",
    defaultModel: "grok-4", models: ["grok-4", "grok-4-fast", "grok-3", "grok-3-mini"],
    caps: ["image"],
    imageGen: { defaultModel: "grok-2-image", models: ["grok-2-image"] },
  },
  openrouter: {
    name: "OpenRouter", color: "var(--openrouter)", kind: "openai", base: "https://openrouter.ai/api/v1", keyUrl: "https://openrouter.ai/keys",
    defaultModel: "mistralai/mistral-large", models: ["mistralai/mistral-large", "meta-llama/llama-3.3-70b-instruct", "deepseek/deepseek-chat", "x-ai/grok-4", "qwen/qwen-2.5-72b-instruct"],
    caps: ["image", "pdf"],
  },
  ollama: {
    name: "Ollama", color: "var(--ollama)", kind: "openai", local: true, defaultUrl: "http://localhost:11434",
    defaultModel: "llama3.2", models: ["llama3.2", "gemma3", "mistral", "qwen2.5", "deepseek-r1", "llava"],
    caps: ["image"], help: "https://ollama.com/download",
  },
  lmstudio: {
    name: "LM Studio", color: "var(--lmstudio)", kind: "openai", local: true, defaultUrl: "http://localhost:1234",
    defaultModel: "", models: [], caps: ["image"], help: "https://lmstudio.ai",
  },
};
const ORDER = Object.keys(PROVIDERS);

/* Recherche de mots entiers, accents compris (\b de JavaScript ignore « é », « è »…) */
const words = (alt) => new RegExp(`(?<![\\p{L}\\d_])(?:${alt})(?![\\p{L}\\d_])`, "iu");
const near = (a, b) => new RegExp(`(?<![\\p{L}\\d_])(?:${a})(?![\\p{L}\\d_])[^.?!\\n]{0,40}(?<![\\p{L}\\d_])(?:${b})(?![\\p{L}\\d_])`, "iu");
const MAKE = "crée|créer|cree|creer|génère|générer|genere|generer|fais|faire|réalise|réaliser|produis|anime|animer|dessine|dessiner|imagine";

/* Tâches du mode Auto (testées dans l'ordre, la première qui correspond gagne) */
const TASKS = [
  { id: "private", label: "🔒 Privé / confidentiel", hint: "message contenant #privé ou #local", def: "ollama",
    test: (t) => /#(privée?|privee?|local|confidentiel)(?![\p{L}\d_])/iu.test(t) },
  { id: "video-gen", label: "🎬 Créer une vidéo", hint: "« crée une vidéo de… »", def: "gemini", need: "videoGen",
    test: (t) => near(MAKE, "vidéo|video|vidéos|videos|clip|film|animation").test(t) },
  { id: "image-gen", label: "🎨 Créer une image", hint: "« dessine… », « génère une image de… »", def: "openai", need: "imageGen",
    test: (t) => /^\s*(dessine|imagine)(?![\p{L}])/iu.test(t) || near(MAKE, "images?|dessins?|illustrations?|logos?|photos?|affiches?|wallpaper|fond d'écran|portraits?|avatar").test(t) },
  { id: "video", label: "🎞️ Analyser une vidéo / un audio", hint: "vidéo, audio ou lien YouTube joint", def: "gemini",
    test: (t, f) => f.some((x) => x.kind === "video" || x.kind === "audio") || YT_RE().test(t) },
  { id: "doc", label: "📄 Lire un PDF", hint: "PDF joint", def: "claude", test: (t, f) => f.some((x) => x.kind === "pdf") },
  { id: "vision", label: "🖼️ Analyser une image", hint: "image jointe", def: "gemini", test: (t, f) => f.some((x) => x.kind === "image") },
  { id: "code", label: "💻 Programmation", hint: "code, bug, script, Python…", def: "claude",
    test: (t) => t.includes("```") || words("code|coder|codage|fonction|bug|bugs|debug|déboguer|script|python|javascript|typescript|java|php|sql|html|css|api|regex|algorithme|programme|programmer|compiler|stack ?trace").test(t) },
  { id: "news", label: "📰 Actualité & réseaux sociaux", hint: "actu, news, aujourd'hui, tendance…", def: "grok",
    test: (t) => words("actu|actus|actualité|actualités|actualite|news|aujourd'hui|en ce moment|dernières? nouvelles|tendances?|twitter|tweets?|buzz|récemment|cette semaine").test(t) },
  { id: "write", label: "✍️ Rédaction & traduction", hint: "écris, rédige, traduis, résume…", def: "claude",
    test: (t) => words("rédige|rédiger|redige|écris|écrire|ecris|traduis|traduire|traduction|résume|résumer|resume|reformule|reformuler|corrige|corriger|lettre|e-?mail|mail|article|poème|poeme|histoire|discours").test(t) },
  { id: "general", label: "💬 Tout le reste", hint: "questions générales", def: "claude", test: () => true },
];
const YT_RE = () => /https?:\/\/(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?[^\s]*v=|shorts\/|live\/)|youtu\.be\/)[\w-]+[^\s]*/gi;

/* =====================================================================
   Stockage : réglages dans localStorage, conversations dans IndexedDB
   (IndexedDB permet de garder images et vidéos jointes)
   ===================================================================== */
const ls = {
  get(k, def) { try { const v = localStorage.getItem("coda:" + k); return v ? JSON.parse(v) : def; } catch { return def; } },
  set(k, v) { try { localStorage.setItem("coda:" + k, JSON.stringify(v)); } catch {} },
};
const idb = {
  db: null,
  open() {
    if (this.db) return Promise.resolve(this.db);
    return new Promise((res, rej) => {
      const r = indexedDB.open("coda", 1);
      r.onupgradeneeded = () => r.result.createObjectStore("kv");
      r.onsuccess = () => res(this.db = r.result);
      r.onerror = () => rej(r.error);
    });
  },
  async get(k) {
    const db = await this.open();
    return new Promise((res, rej) => { const q = db.transaction("kv").objectStore("kv").get(k); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); });
  },
  async set(k, v) {
    const db = await this.open();
    return new Promise((res, rej) => { const tx = db.transaction("kv", "readwrite"); tx.objectStore("kv").put(v, k); tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
  },
};

let settings = {
  keys: {}, models: {}, imageModels: {}, videoModels: {}, urls: {}, local: {}, routes: {},
  system: "", judge: "auto", autoJudge: true, ...ls.get("settings", {}),
};
let ui = { mode: "auto", single: "claude", compare: ["claude", "openai", "gemini", "grok"], subs: ["auto"], theme: "", ...ls.get("ui", {}) };

/* Mode Abonnements : ouvre les sites officiels (où vous êtes connecté) avec la question pré-remplie.
   Aucune clé API, aucun frais : c'est votre abonnement qui sert. */
const SUBS = {
  openai: { name: "ChatGPT", url: (q) => "https://chatgpt.com/?q=" + encodeURIComponent(q) },
  claude: { name: "Claude", url: (q) => "https://claude.ai/new?q=" + encodeURIComponent(q) },
  gemini: { name: "Gemini", url: () => "https://gemini.google.com/app", paste: true },
  grok: { name: "Grok", url: (q) => "https://grok.com/?q=" + encodeURIComponent(q) },
};
const SUB_IDS = Object.keys(SUBS);
function subRoute(text, files) {
  const task = TASKS.find((t) => t.test(text, files));
  const want = settings.routes[task.id] || task.def;
  return { id: SUBS[want] ? want : SUBS[task.def] ? task.def : "openai", task };
}
function subTargets(text, files) {
  const f = forcedProvider(text);
  if (f && SUBS[f.id]) return { ids: [f.id], text: f.rest.trim() };
  if (ui.subs.includes("auto")) { const r = subRoute(text, files); return { ids: [r.id], text, task: r.task }; }
  return { ids: ui.subs.filter((id) => SUBS[id]), text };
}
let conversations = [];
let currentId = null;
let attachments = [];
const controllers = new Set();

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
const secs = (ms) => (ms / 1000).toFixed(1).replace(".", ",") + " s";
const saveUi = () => ls.set("ui", ui);
let saveTimer = 0;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => idb.set("conversations", conversations).catch((e) => console.error("Sauvegarde impossible", e)), 250);
}

/* ---------- État des fournisseurs ---------- */
const P = (id) => PROVIDERS[id];
const ready = (id) => P(id).local ? !!settings.local[id] : !!settings.keys[id];
const modelOf = (id) => settings.models[id] || P(id).defaultModel;
const imageModelOf = (id) => settings.imageModels[id] || P(id).imageGen?.defaultModel;
const videoModelOf = (id) => settings.videoModels[id] || P(id).videoGen?.defaultModel;
const urlOf = (id) => (settings.urls[id] || P(id).defaultUrl || "").replace(/\/+$/, "");
const baseOf = (id) => P(id).local ? urlOf(id) + "/v1" : P(id).base;
const can = (id, need) => need === "imageGen" ? !!P(id).imageGen : need === "videoGen" ? !!P(id).videoGen : P(id).caps.includes(need);
const judgeOf = () => settings.judge !== "auto" && ready(settings.judge) ? settings.judge : ORDER.find(ready);
const taskLabel = (id) => TASKS.find((t) => t.id === id)?.label || "";

/* ---------- Markdown ---------- */
function md(text) {
  if (window.marked && window.DOMPurify) return DOMPurify.sanitize(marked.parse(text));
  return esc(text).replace(/\n/g, "<br>");
}

/* ---------- Thème ---------- */
function applyTheme() { if (ui.theme) document.documentElement.dataset.theme = ui.theme; else delete document.documentElement.dataset.theme; }
$("#themeBtn").onclick = () => {
  const dark = ui.theme ? ui.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
  ui.theme = dark ? "light" : "dark"; saveUi(); applyTheme();
};

/* =====================================================================
   Barre du haut : mode + choix des IA
   ===================================================================== */
function renderPicker() {
  document.querySelectorAll("#modeSeg button").forEach((b) => b.classList.toggle("on", b.dataset.mode === ui.mode));
  const picker = $("#picker"); picker.innerHTML = "";
  if (ui.mode === "subs") {
    const chips = [["auto", "✦ Auto", "var(--accent)"], ...SUB_IDS.map((id) => [id, SUBS[id].name, P(id).color])];
    for (const [id, name, color] of chips) {
      const on = ui.subs.includes(id);
      const chip = document.createElement("button");
      chip.className = "chip" + (on ? " on" : "");
      chip.innerHTML = `<span class="dot" style="background:${color}"></span>${esc(name)}`;
      chip.onclick = () => {
        if (id === "auto") ui.subs = on ? [] : ["auto"];
        else ui.subs = on ? ui.subs.filter((x) => x !== id) : [...ui.subs.filter((x) => x !== "auto"), id];
        saveUi(); renderPicker();
      };
      picker.appendChild(chip);
    }
    updateHint(); return;
  }
  if (ui.mode === "auto") {
    picker.innerHTML = `<span class="autoinfo">L'IA est choisie selon votre demande · <button type="button">personnaliser</button></span>`;
    picker.querySelector("button").onclick = () => openSettings("routes");
    updateHint(); return;
  }
  for (const id of ORDER) {
    const p = P(id);
    const on = ui.mode === "single" ? ui.single === id : ui.compare.includes(id);
    const chip = document.createElement("button");
    chip.className = "chip" + (on ? " on" : "") + (ready(id) ? "" : " off");
    chip.title = ready(id) ? modelOf(id) : (p.local ? "Non activée — voir Réglages › IA locales" : "Clé API manquante — voir Réglages");
    chip.innerHTML = `<span class="dot" style="background:${p.color}"></span>${p.name}${p.local ? " 💻" : ""}`;
    chip.onclick = () => {
      if (!ready(id)) { openSettings(p.local ? "local" : "cloud", id); return; }
      if (ui.mode === "single") ui.single = id;
      else ui.compare = on ? ui.compare.filter((x) => x !== id) : [...ui.compare, id];
      saveUi(); renderPicker();
    };
    picker.appendChild(chip);
  }
  updateHint();
}
document.querySelectorAll("#modeSeg button").forEach((b) => b.onclick = () => { ui.mode = b.dataset.mode; saveUi(); renderPicker(); });

/* =====================================================================
   Routage (mode Auto)
   ===================================================================== */
function forcedProvider(text) {
  const m = text.match(/^\s*@([\w-]+)\s*/);
  if (!m) return null;
  const k = m[1].toLowerCase();
  const id = ORDER.find((x) => x === k || P(x).name.toLowerCase().replace(/\s/g, "") === k || (k === "chatgpt" && x === "openai") || (k === "gpt" && x === "openai"));
  return id ? { id, rest: text.slice(m[0].length) } : null;
}
function genTask(text) {
  if (TASKS.find((t) => t.id === "video-gen").test(text)) return "video-gen";
  if (TASKS.find((t) => t.id === "image-gen").test(text)) return "image-gen";
  return "chat";
}
// Tâche réellement exécutée par une IA donnée (création si elle sait faire, sinon discussion)
function taskFor(id, text) {
  const g = genTask(text);
  if (g === "video-gen" && can(id, "videoGen")) return "video-gen";
  if (g === "image-gen" && can(id, "imageGen")) return "image-gen";
  return "chat";
}
function route(text, files) {
  const task = TASKS.find((t) => t.test(text, files));
  const wanted = settings.routes[task.id] || task.def;
  const media = files.filter((f) => f.kind !== "text").map((f) => f.kind);
  const strict = (x) => ready(x) && (!task.need || can(x, task.need)) && media.every((k) => can(x, k)) && (task.id !== "video" || !YT_RE().test(text) || can(x, "youtube"));
  const loose = (x) => ready(x) && (!task.need || can(x, task.need));
  let id = strict(wanted) ? wanted : ORDER.find(strict) || (loose(wanted) ? wanted : ORDER.find(loose));
  if (!id && task.need) {
    const cand = ORDER.filter((x) => can(x, task.need)).map((x) => P(x).name).join(" ou ");
    return { task, wanted, error: `Aucune IA configurée ne sait « ${task.label.replace(/^\S+\s/, "")} ». Ajoutez une clé ${cand} dans les Réglages.` };
  }
  if (!id && task.id === "private") return { task, wanted, error: "Aucune IA locale activée. Installez Ollama puis activez-le dans Réglages › IA locales." };
  if (!id) return { task, wanted, error: "Aucune IA n'est configurée. Ouvrez les Réglages." };
  return { task, wanted, id, fallback: id !== wanted };
}
function updateHint() {
  const hint = $("#hint");
  const text = $("#input").value;
  const f = forcedProvider(text);
  if (f) { hint.innerHTML = `→ forcé vers <b>${esc(P(f.id).name)}</b>`; return; }
  if (ui.mode === "subs" && text.trim()) {
    const s = subTargets(text, attachments);
    hint.innerHTML = s.ids.length ? `→ ouvre <b>${s.ids.map((id) => esc(SUBS[id].name)).join(", ")}</b>${s.task ? " · " + esc(s.task.label) : ""} avec votre abonnement`
      : "Choisissez au moins une IA ci-dessus.";
    return;
  }
  if (ui.mode === "auto" && (text.trim() || attachments.length)) {
    const r = route(text, attachments);
    hint.innerHTML = r.error ? `<span class="err">${esc(r.error)}</span>`
      : `→ <b>${esc(P(r.id).name)}</b> · ${esc(r.task.label)}${r.fallback ? ` <span title="${esc(P(r.wanted).name)} n'est pas disponible">(remplace ${esc(P(r.wanted).name)})</span>` : ""}`;
    return;
  }
  hint.textContent = "Entrée pour envoyer · Maj+Entrée pour une nouvelle ligne · 📎 ou glisser-déposer pour joindre un fichier";
}

/* =====================================================================
   Pièces jointes
   ===================================================================== */
const MAX_FILE = 20 * 1024 * 1024;
const TEXT_EXT = /\.(txt|md|csv|json|xml|yaml|yml|html?|css|js|mjs|ts|tsx|jsx|py|java|c|cpp|h|cs|go|rs|rb|php|sh|sql|log|ini|toml)$/i;
function kindOf(file) {
  const t = file.type || "";
  if (t.startsWith("image/")) return "image";
  if (t === "application/pdf") return "pdf";
  if (t.startsWith("video/")) return "video";
  if (t.startsWith("audio/")) return "audio";
  if (t.startsWith("text/") || t.includes("json") || t.includes("xml") || TEXT_EXT.test(file.name)) return "text";
  return null;
}
const readAs = (file, how) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); r[how](file); });
async function addFiles(list) {
  for (const file of list) {
    const kind = kindOf(file);
    if (!kind) { alert(`« ${file.name} » : type de fichier non pris en charge.`); continue; }
    if (file.size > MAX_FILE) { alert(`« ${file.name} » dépasse 20 Mo (limite des IA pour un envoi direct).`); continue; }
    const f = { id: uid(), name: file.name || "fichier", mime: file.type || "text/plain", kind, size: file.size };
    if (kind === "text") f.text = await readAs(file, "readAsText");
    else f.data = (await readAs(file, "readAsDataURL")).split(",")[1];
    attachments.push(f);
  }
  renderAttachments(); updateHint();
}
const ICON = { image: "🖼️", pdf: "📄", video: "🎬", audio: "🎵", text: "📝" };
function fileChip(f, removable) {
  const thumb = f.kind === "image" && f.data ? `<img src="data:${esc(f.mime)};base64,${f.data}" alt="">` : ICON[f.kind];
  return `<span class="fchip" data-fid="${f.id}" title="${esc(f.name)}">${thumb}<span>${esc(f.name)}</span>${removable ? `<button type="button" title="Retirer">✕</button>` : ""}</span>`;
}
function renderAttachments() {
  const bar = $("#attachBar");
  bar.innerHTML = attachments.map((f) => fileChip(f, true)).join("");
  bar.querySelectorAll(".fchip button").forEach((b) => b.onclick = () => {
    attachments = attachments.filter((f) => f.id !== b.parentElement.dataset.fid); renderAttachments(); updateHint();
  });
}
$("#attachBtn").onclick = () => $("#fileInput").click();
$("#fileInput").onchange = (e) => { addFiles([...e.target.files]); e.target.value = ""; };
$("#input").addEventListener("paste", (e) => { const fs = [...(e.clipboardData?.files || [])]; if (fs.length) { e.preventDefault(); addFiles(fs); } });
let dragDepth = 0;
document.addEventListener("dragenter", (e) => { if (e.dataTransfer?.types?.includes("Files")) { dragDepth++; document.body.classList.add("dragging"); } });
document.addEventListener("dragleave", () => { if (--dragDepth <= 0) { dragDepth = 0; document.body.classList.remove("dragging"); } });
document.addEventListener("dragover", (e) => e.preventDefault());
document.addEventListener("drop", (e) => { e.preventDefault(); dragDepth = 0; document.body.classList.remove("dragging"); if (e.dataTransfer?.files?.length) addFiles([...e.dataTransfer.files]); });

/* =====================================================================
   Conversations (liste + fil)
   ===================================================================== */
const current = () => conversations.find((c) => c.id === currentId);
function renderList() {
  const list = $("#convList"); list.innerHTML = "";
  for (const c of conversations) {
    const el = document.createElement("div");
    el.className = "conv" + (c.id === currentId ? " active" : "");
    el.innerHTML = `<span class="t"></span><button class="del" title="Supprimer">✕</button>`;
    el.querySelector(".t").textContent = c.title;
    el.onclick = () => { currentId = c.id; renderList(); renderThread(); document.body.classList.remove("side-open"); };
    el.querySelector(".del").onclick = (e) => {
      e.stopPropagation();
      if (!confirm("Supprimer cette conversation ?")) return;
      conversations = conversations.filter((x) => x.id !== c.id);
      if (currentId === c.id) currentId = null;
      save(); renderList(); renderThread(); renderBoard();
    };
    list.appendChild(el);
  }
}
$("#newChat").onclick = () => { currentId = null; renderList(); renderThread(); $("#input").focus(); document.body.classList.remove("side-open"); };
$("#menuBtn").onclick = () => document.body.classList.toggle("side-open");

function renderThread() {
  const conv = current(); const thread = $("#thread");
  if (!conv || !conv.turns.length) {
    const ready_ = ORDER.filter(ready);
    thread.innerHTML = `<div id="empty"><h1>Toutes vos IA, au même endroit</h1>
      <p>${ready_.length ? `Prêtes : <b>${ready_.map((x) => esc(P(x).name)).join(", ")}</b>`
        : "Ajoutez une clé API, ou utilisez une IA locale gratuite et sans compte (Ollama)."}</p>
      ${ready_.length ? "" : `<button class="btn primary" id="emptySetup">Configurer mes IA</button>`}
      <div class="cards">
        <div><b>✦ Auto</b>Chaque demande part vers la meilleure IA pour la tâche : vidéos → Gemini, code → Claude, actu → Grok…</div>
        <div><b>⚖ Comparer</b>Posez une question à plusieurs IA ; un arbitre note les réponses et désigne la meilleure.</div>
        <div><b>📎 Fichiers</b>Images, PDF, vidéos, audio, liens YouTube : glissez-les ici.</div>
        <div><b>🎨 Création</b>« Dessine un chat astronaute », « crée une vidéo d'une plage au coucher du soleil ».</div>
        <div><b>💻 Local</b>Avec Ollama, discutez sans compte, sans clé, sans internet.</div>
      </div></div>`;
    const b = $("#emptySetup"); if (b) b.onclick = () => openSettings();
    return;
  }
  thread.innerHTML = "";
  conv.turns.forEach((t) => thread.appendChild(turnEl(t)));
  scrollDown(true);
}
function turnEl(t) {
  const el = document.createElement("div"); el.className = "turn"; el.dataset.tid = t.id;
  const multi = t.replies.length > 1;
  const files = (t.files || []).length
    ? `<div class="files">${t.files.map((f) => f.kind === "image" && f.data ? `<img src="data:${esc(f.mime)};base64,${f.data}" alt="${esc(f.name)}" title="${esc(f.name)}">` : fileChip(f, false)).join("")}</div>` : "";
  el.innerHTML = `<div class="user">${files}<div class="txt"></div></div><div class="replies${multi ? " multi" : ""}"></div><div class="vslot"></div>`;
  el.querySelector(".txt").textContent = t.user;
  if (!t.user) el.querySelector(".txt").remove();
  const box = el.querySelector(".replies");
  t.replies.forEach((r) => box.appendChild(replyEl(r, multi, t.judge)));
  renderVerdict(t, el);
  return el;
}
function replyEl(r, multi, judge) {
  const p = P(r.provider);
  const sc = judge?.status === "done" ? judge.scores[r.id] : null;
  const win = judge?.status === "done" && judge.winner === r.id;
  const elapsed = r.start ? ((r.end || Date.now()) - r.start) : 0;
  const el = document.createElement("div");
  el.className = "reply" + (win ? " winner" : ""); el.dataset.rid = r.id;
  el.innerHTML = `<div class="who"><span class="dot" style="background:${p.color}"></span>${win ? `<span class="crown">🏆</span>` : ""}<b>${esc(p.name)}</b>
      <span>· ${esc(r.model)}</span>${r.task && r.task !== "general" && r.routed ? `<span class="tag">${esc(taskLabel(r.task))}</span>` : ""}
      ${r.start ? `<span class="time">· ${r.pending ? "⏱ " : ""}${secs(elapsed)}</span>` : ""}
      <span class="right">${sc ? `<span class="score">${esc(sc.note)}/10</span>` : ""}${!r.pending && r.content && !r.error ? `<button class="copy" title="Copier">Copier</button>` : ""}</span></div>
    ${r.status && r.pending ? `<div class="status typing"></div>` : ""}
    ${r.error ? `<div class="err"></div>` : (r.content || (r.pending && r.kind !== "gen") ? `<div class="body${r.pending ? " typing" : ""}">${md(r.content || "")}</div>` : "")}
    ${(r.images || []).length || r.video || r.videoLink ? `<div class="gen"></div>` : ""}
    ${r.kind === "link" ? `<div class="sublink"><a class="btn small" href="${esc(r.link)}" target="_blank" rel="noopener">Ouvrir dans ${esc(SUBS[r.provider]?.name || p.name)} ↗</a>
      <span class="note">${r.paste ? "Votre question est copiée : collez-la avec Ctrl+V (⌘+V sur Mac)." : "La réponse s'affiche sur le site, avec votre abonnement."}</span></div>` : ""}
    ${r.note ? `<div class="warnline"></div>` : ""}
    ${sc?.commentaire ? `<div class="cmt"></div>` : ""}`;
  const q = (s) => el.querySelector(s);
  if (q(".status")) q(".status").textContent = r.status;
  if (q(".err")) q(".err").textContent = "⚠ " + r.error;
  if (q(".warnline")) q(".warnline").textContent = "⚠ " + r.note;
  if (q(".cmt")) q(".cmt").textContent = "⚖ " + sc.commentaire;
  const gen = q(".gen");
  if (gen) {
    for (const src of r.images || []) {
      const a = document.createElement("a"); a.href = src; a.download = "image-coda.png"; a.title = "Télécharger";
      const img = document.createElement("img"); img.src = src; img.alt = "Image générée"; a.appendChild(img); gen.appendChild(a);
    }
    if (r.video) { const v = document.createElement("video"); v.src = r.video; v.controls = true; gen.appendChild(v);
      const a = document.createElement("a"); a.href = r.video; a.download = "video-coda.mp4"; a.textContent = "⬇ Télécharger la vidéo"; gen.appendChild(a); }
    else if (r.videoLink) { const a = document.createElement("a"); a.href = r.videoLink; a.target = "_blank"; a.rel = "noopener"; a.textContent = "▶ Ouvrir la vidéo générée"; gen.appendChild(a); }
  }
  const copy = q(".copy");
  if (copy) copy.onclick = () => { navigator.clipboard?.writeText(r.content || ""); copy.textContent = "Copié ✓"; setTimeout(() => copy.textContent = "Copier", 1200); };
  return el;
}
function findTurn(rid) { for (const c of conversations) for (const t of c.turns) if (t.replies.some((r) => r.id === rid)) return t; }
function updateReply(r) {
  const node = document.querySelector(`[data-rid="${r.id}"]`); if (!node) return;
  const t = findTurn(r.id);
  node.replaceWith(replyEl(r, t ? t.replies.length > 1 : false, t?.judge));
}
function scrollDown(force) {
  const m = $("#messages");
  if (force || m.scrollHeight - m.scrollTop - m.clientHeight < 120) m.scrollTop = m.scrollHeight;
}

/* =====================================================================
   Construction des requêtes
   ===================================================================== */
function historyFor(conv, provider, uptoTurn) {
  const msgs = [];
  const upto = conv.turns.indexOf(uptoTurn);
  for (const [i, t] of conv.turns.entries()) {
    msgs.push({ role: "user", text: t.user, files: upto - i < 3 ? t.files || [] : [] });
    if (t === uptoTurn) break;
    const r = t.replies.find((x) => x.provider === provider && (x.content || x.images?.length)) || t.replies.find((x) => x.content);
    if (r) msgs.push({ role: "assistant", text: r.content || "[image générée]" });
    else msgs.pop(); // tour sans réponse : ignoré pour garder l'alternance user/assistant
  }
  return msgs;
}
// Adapte un message aux capacités de l'IA (fichiers texte intégrés, fichiers incompris retirés)
function prep(id, m) {
  let text = m.text || "";
  const files = [], dropped = [];
  for (const f of m.files || []) {
    if (f.kind === "text") text = `--- Fichier : ${f.name} ---\n${f.text}\n--- Fin du fichier ---\n\n` + text;
    else if (can(id, f.kind) && f.data) files.push(f);
    else dropped.push(f.name);
  }
  if (dropped.length) text += `\n\n[Pièces jointes que tu ne peux pas lire : ${dropped.join(", ")}]`;
  if (!text.trim()) text = "Analyse ce fichier.";
  return { text, files, dropped };
}
const dataUrl = (f) => `data:${f.mime};base64,${f.data}`;

function buildRequest(id, msgs, system) {
  const p = P(id), key = settings.keys[id], model = modelOf(id);
  if (!model) throw new Error(`Aucun modèle choisi pour ${p.name} (voir Réglages).`);
  if (p.kind === "anthropic") {
    return {
      url: "https://api.anthropic.com/v1/messages",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
      body: {
        model, max_tokens: 8192, stream: true, ...(system ? { system } : {}),
        messages: msgs.map((m) => {
          if (m.role !== "user") return { role: m.role, content: m.text };
          const { text, files } = prep(id, m);
          if (!files.length) return { role: "user", content: text };
          return { role: "user", content: [
            ...files.map((f) => f.kind === "image"
              ? { type: "image", source: { type: "base64", media_type: f.mime, data: f.data } }
              : { type: "document", source: { type: "base64", media_type: "application/pdf", data: f.data } }),
            { type: "text", text },
          ] };
        }),
      },
      pick: (d) => d.type === "content_block_delta" && d.delta?.type === "text_delta" ? d.delta.text : "",
    };
  }
  if (p.kind === "gemini") {
    return {
      url: `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`,
      headers: { "x-goog-api-key": key },
      body: {
        ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
        contents: msgs.map((m) => {
          if (m.role !== "user") return { role: "model", parts: [{ text: m.text }] };
          const { text, files } = prep(id, m);
          const yt = [...new Set(text.match(YT_RE()) || [])];
          return { role: "user", parts: [
            ...files.map((f) => ({ inline_data: { mime_type: f.mime, data: f.data } })),
            ...yt.map((u) => ({ file_data: { file_uri: u } })),
            { text },
          ] };
        }),
      },
      pick: (d) => (d.candidates?.[0]?.content?.parts || []).filter((x) => !x.thought).map((x) => x.text || "").join(""),
    };
  }
  // Compatible OpenAI : ChatGPT, Grok, OpenRouter, Ollama, LM Studio
  const headers = key ? { Authorization: "Bearer " + key } : {};
  if (id === "openrouter") headers["X-Title"] = "Coda";
  const messages = msgs.map((m) => {
    if (m.role !== "user") return { role: m.role, content: m.text };
    const { text, files } = prep(id, m);
    if (!files.length) return { role: "user", content: text };
    return { role: "user", content: [
      { type: "text", text },
      ...files.map((f) => f.kind === "image"
        ? { type: "image_url", image_url: { url: dataUrl(f) } }
        : { type: "file", file: { filename: f.name, file_data: dataUrl(f) } }),
    ] };
  });
  return {
    url: baseOf(id) + "/chat/completions", headers,
    body: { model, stream: true, messages: system ? [{ role: "system", content: system }, ...messages] : messages },
    pick: (d) => d.choices?.[0]?.delta?.content || "",
  };
}

function friendlyError(id, e) {
  if (/Failed to fetch|NetworkError|Load failed/i.test(e.message)) {
    if (P(id).local) return `${P(id).name} ne répond pas à ${urlOf(id)}. Est-il lancé ? ` +
      (id === "ollama" ? "Ouvrez l'application Ollama (ou tapez « ollama serve »), et ouvrez ce site via le script « lancer »." : "Démarrez le serveur local de LM Studio et activez CORS dans ses réglages.");
    return "Impossible de joindre le fournisseur (connexion internet, clé invalide ou blocage du navigateur).";
  }
  return e.message;
}
async function apiError(res) {
  let msg = `Erreur ${res.status}`;
  try { const j = await res.json(); msg += " : " + (j.error?.message || j.message || j.detail || JSON.stringify(j)); } catch {}
  if (res.status === 401 || res.status === 403) msg += " — vérifiez votre clé API.";
  if (res.status === 404) msg += " — le nom du modèle est peut-être incorrect (Réglages).";
  if (res.status === 429) msg += " — quota dépassé ou trop de requêtes.";
  return new Error(msg);
}

/* ---------- Discussion en streaming (SSE) ---------- */
async function chatStream(id, msgs, onText, signal, system = settings.system.trim()) {
  const req = buildRequest(id, msgs, system);
  const res = await fetch(req.url, { method: "POST", signal, headers: { "Content-Type": "application/json", ...req.headers }, body: JSON.stringify(req.body) });
  if (!res.ok) throw await apiError(res);
  const reader = res.body.getReader(); const dec = new TextDecoder(); let buf = "";
  for (;;) {
    const { value, done } = await reader.read(); if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (!data || data === "[DONE]") continue;
      let d; try { d = JSON.parse(data); } catch { continue; }
      if (d.type === "error" || (d.error && !d.choices)) throw new Error(d.error?.message || "Erreur du fournisseur");
      const t = req.pick(d); if (t) onText(t);
    }
  }
}

/* ---------- Création d'images ---------- */
async function generateImage(id, prompt, signal) {
  const key = settings.keys[id], model = imageModelOf(id);
  if (P(id).kind === "gemini") {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST", signal, headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { responseModalities: ["TEXT", "IMAGE"] } }),
    });
    if (!res.ok) throw await apiError(res);
    const parts = (await res.json()).candidates?.[0]?.content?.parts || [];
    const images = parts.map((x) => x.inlineData || x.inline_data).filter(Boolean).map((x) => `data:${x.mimeType || x.mime_type};base64,${x.data}`);
    if (!images.length) throw new Error("Gemini n'a pas renvoyé d'image (demande refusée ou modèle sans génération d'image).");
    return { images, text: parts.map((x) => x.text || "").join("").trim(), model };
  }
  const body = { model, prompt, n: 1 };
  if (id === "grok" || model.startsWith("dall-e")) body.response_format = "b64_json";
  const res = await fetch(baseOf(id) + "/images/generations", {
    method: "POST", signal, headers: { "Content-Type": "application/json", Authorization: "Bearer " + key }, body: JSON.stringify(body),
  });
  if (!res.ok) throw await apiError(res);
  const data = (await res.json()).data || [];
  const images = data.map((x) => x.b64_json ? "data:image/png;base64," + x.b64_json : x.url).filter(Boolean);
  if (!images.length) throw new Error("Aucune image renvoyée.");
  return { images, text: data[0]?.revised_prompt ? "Prompt utilisé : " + data[0].revised_prompt : "", model };
}

/* ---------- Création de vidéos (Gemini Veo) ---------- */
async function generateVideo(id, prompt, signal, onStatus) {
  const key = settings.keys[id], model = videoModelOf(id);
  const api = "https://generativelanguage.googleapis.com/v1beta/";
  const res = await fetch(`${api}models/${encodeURIComponent(model)}:predictLongRunning`, {
    method: "POST", signal, headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({ instances: [{ prompt }] }),
  });
  if (!res.ok) throw await apiError(res);
  let op = await res.json();
  const t0 = Date.now();
  while (!op.done) {
    if (Date.now() - t0 > 15 * 60e3) throw new Error("La génération de la vidéo a pris trop de temps.");
    onStatus(`🎬 Gemini crée la vidéo… (${Math.round((Date.now() - t0) / 1000)} s, cela prend souvent 1 à 3 min)`);
    await new Promise((ok, ko) => { const tm = setTimeout(ok, 8000); signal.addEventListener("abort", () => { clearTimeout(tm); ko(new DOMException("Arrêté", "AbortError")); }, { once: true }); });
    const r = await fetch(api + op.name, { signal, headers: { "x-goog-api-key": key } });
    if (!r.ok) throw await apiError(r);
    op = await r.json();
  }
  if (op.error) throw new Error(op.error.message || "Échec de la génération");
  const resp = op.response?.generateVideoResponse || op.response || {};
  const uri = (resp.generatedSamples || resp.generatedVideos || [])[0]?.video?.uri;
  if (!uri) throw new Error("Aucune vidéo renvoyée (la demande a peut-être été filtrée par Google).");
  onStatus("⬇ Téléchargement de la vidéo…");
  try {
    const v = await fetch(uri, { signal, headers: { "x-goog-api-key": key } });
    if (!v.ok) throw new Error();
    const blob = await v.blob();
    return { video: await readAs(blob, "readAsDataURL"), model };
  } catch (e) {
    if (e.name === "AbortError") throw e;
    return { videoLink: uri + (uri.includes("?") ? "&" : "?") + "key=" + encodeURIComponent(key), model };
  }
}

/* =====================================================================
   Envoi d'un message
   ===================================================================== */
async function send() {
  const input = $("#input");
  let text = input.value.trim();
  const files = attachments;
  if ((!text && !files.length) || controllers.size) return;
  if (ui.mode === "subs") { sendSubs(text, files); return; }
  if (!ORDER.some(ready)) { openSettings(); return; }

  // Qui répond ?
  let plans;
  const forced = forcedProvider(text);
  if (forced) {
    text = forced.rest.trim();
    if (!ready(forced.id)) { alert(`${P(forced.id).name} n'est pas configurée (Réglages).`); return; }
    plans = [{ provider: forced.id, kind: taskFor(forced.id, text) }];
  } else if (ui.mode === "auto") {
    const r = route(text, files);
    plans = [r.error ? { provider: r.wanted, error: r.error, task: r.task.id, routed: true }
      : { provider: r.id, kind: r.task.need === "imageGen" ? "image-gen" : r.task.need === "videoGen" ? "video-gen" : "chat", task: r.task.id, routed: true }];
  } else if (ui.mode === "single") {
    if (!ready(ui.single)) { openSettings(); return; }
    plans = [{ provider: ui.single, kind: taskFor(ui.single, text) }];
  } else {
    const targets = ui.compare.filter(ready);
    if (!targets.length) { alert("Sélectionnez au moins une IA configurée."); return; }
    plans = targets.map((id) => ({ provider: id, kind: "chat" }));
  }

  let conv = current();
  if (!conv) {
    conv = { id: uid(), title: (text || files[0]?.name || "Conversation").slice(0, 60), turns: [], created: Date.now() };
    conversations.unshift(conv); currentId = conv.id;
  }
  const turn = {
    id: uid(), user: text, files,
    replies: plans.map((pl) => ({
      id: uid(), provider: pl.provider, task: pl.task, routed: !!pl.routed, kind: pl.kind === "chat" ? "chat" : "gen", job: pl.kind,
      model: pl.kind === "image-gen" ? imageModelOf(pl.provider) : pl.kind === "video-gen" ? videoModelOf(pl.provider) : modelOf(pl.provider),
      content: "", pending: !pl.error, error: pl.error,
    })),
  };
  conv.turns.push(turn);
  attachments = []; renderAttachments();
  input.value = ""; autosize(); updateHint();
  save(); renderList();
  if (conv.turns.length === 1) renderThread(); else { $("#thread").appendChild(turnEl(turn)); scrollDown(true); }
  setBusy(true);

  await Promise.all(turn.replies.filter((r) => r.pending).map((r) => runReply(conv, turn, r)));
  setBusy(false);
  if (turn.replies.length > 1 && settings.autoJudge && turn.replies.filter((r) => r.content && !r.error).length >= 2) judgeTurn(turn);
}

function sendSubs(text, files) {
  const s = subTargets(text, files);
  if (!s.ids.length || !s.text) return;
  const long = s.text.length > 6000; // au-delà, l'adresse serait trop longue : on passe par le presse-papiers
  const needPaste = s.ids.some((id) => SUBS[id].paste) || long;
  if (needPaste) navigator.clipboard?.writeText(s.text).catch(() => {});
  let conv = current();
  if (!conv) { conv = { id: uid(), title: s.text.slice(0, 60), turns: [], created: Date.now() }; conversations.unshift(conv); currentId = conv.id; }
  const turn = {
    id: uid(), user: s.text, files: [],
    replies: s.ids.map((id) => {
      const paste = SUBS[id].paste || long;
      return { id: uid(), provider: id, model: "abonnement", kind: "link", task: s.task?.id, routed: !!s.task,
        link: paste ? SUBS[id].url("") : SUBS[id].url(s.text), paste, content: "" };
    }),
  };
  let blocked = 0;
  for (const r of turn.replies) { const w = window.open(r.link, "_blank"); if (!w) { blocked++; r.blocked = true; } }
  if (files.length) turn.replies.forEach((r) => r.note = "Les pièces jointes ne peuvent pas être transmises : glissez-les vous-même dans la page de l'IA.");
  if (blocked) turn.replies.filter((r) => r.blocked).forEach((r) => r.note = (r.note ? r.note + " " : "") + "Fenêtre bloquée par le navigateur : cliquez sur le bouton ci-dessus (ou autorisez les pop-ups pour ce site).");
  conv.turns.push(turn);
  attachments = []; renderAttachments();
  $("#input").value = ""; autosize(); updateHint();
  save(); renderList();
  if (conv.turns.length === 1) renderThread(); else { $("#thread").appendChild(turnEl(turn)); scrollDown(true); }
}

async function runReply(conv, turn, r) {
  const ctrl = new AbortController(); controllers.add(ctrl);
  let raf = 0; r.start = Date.now();
  const tick = setInterval(() => updateReply(r), 250);
  try {
    if (r.job === "image-gen") {
      r.status = `🎨 ${P(r.provider).name} dessine…`; updateReply(r);
      Object.assign(r, await generateImage(r.provider, turn.user, ctrl.signal));
      r.content = r.text || ""; delete r.text;
    } else if (r.job === "video-gen") {
      r.status = "🎬 Envoi de la demande à Gemini…"; updateReply(r);
      Object.assign(r, await generateVideo(r.provider, turn.user, ctrl.signal, (s) => { r.status = s; }));
    } else {
      const dropped = prep(r.provider, { text: turn.user, files: turn.files }).dropped;
      if (dropped.length) r.note = `${P(r.provider).name} ne peut pas lire : ${dropped.join(", ")}`;
      await chatStream(r.provider, historyFor(conv, r.provider, turn), (t) => {
        r.content += t;
        if (!raf) raf = requestAnimationFrame(() => { raf = 0; updateReply(r); scrollDown(); });
      }, ctrl.signal);
      if (!r.content) r.error = "Réponse vide.";
    }
  } catch (e) {
    if (e.name === "AbortError") { if (!r.content && !r.images && !r.video) r.error = "Arrêté."; }
    else r.error = friendlyError(r.provider, e);
  } finally {
    cancelAnimationFrame(raf); clearInterval(tick);
    r.end = Date.now(); r.pending = false; delete r.status; controllers.delete(ctrl);
    updateReply(r); save(); scrollDown();
  }
}
function setBusy(b) { const s = $("#send"); s.textContent = b ? "■" : "➤"; s.title = b ? "Arrêter" : "Envoyer"; }
$("#send").onclick = () => controllers.size ? controllers.forEach((c) => c.abort()) : send();
const autosize = () => { const i = $("#input"); i.style.height = "auto"; i.style.height = Math.min(i.scrollHeight, 220) + "px"; };
$("#input").addEventListener("input", () => { autosize(); updateHint(); });
$("#input").addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(); } });

/* =====================================================================
   Arbitre (mode Comparer)
   ===================================================================== */
function renderVerdict(t, el = document.querySelector(`[data-tid="${t.id}"]`)) {
  if (!el) return;
  const slot = el.querySelector(".vslot"); const j = t.judge;
  slot.innerHTML = "";
  if (j) {
    const by = `<small>arbitre : ${esc(P(j.provider)?.name || "?")}</small>`;
    if (j.status === "pending") slot.innerHTML = `<div class="verdict"><span class="v typing">⚖ L'arbitre compare les réponses…</span>${by}</div>`;
    else if (j.status === "error") { slot.innerHTML = `<div class="verdict"><span class="v err"></span><button class="rejudge">↻ Réessayer</button></div>`; slot.querySelector(".err").textContent = "⚖ Arbitrage impossible : " + j.error; }
    else {
      const w = t.replies.find((r) => r.id === j.winner);
      slot.innerHTML = `<div class="verdict"><span class="v">🏆 <b>Meilleure réponse : ${esc(w ? P(w.provider).name : "?")}</b> — <span class="sum"></span></span>${by}<button class="rejudge" title="Juger à nouveau">↻</button></div>`;
      slot.querySelector(".sum").textContent = j.resume || "";
    }
    const btn = slot.querySelector(".rejudge"); if (btn) btn.onclick = () => judgeTurn(t);
  }
  t.replies.forEach((r) => { const n = el.querySelector(`[data-rid="${r.id}"]`); if (n) n.replaceWith(replyEl(r, t.replies.length > 1, j)); });
}
async function judgeTurn(turn) {
  const ok = turn.replies.filter((r) => r.content && !r.error);
  const judge = judgeOf();
  if (ok.length < 2 || !judge || turn.judge?.status === "pending") return;
  const letters = ok.map((_, i) => String.fromCharCode(65 + i));
  const filesNote = (turn.files || []).length ? `\n(L'utilisateur avait joint : ${turn.files.map((f) => f.name).join(", ")})` : "";
  const prompt = `Tu es un arbitre impartial. Plusieurs assistants IA anonymes ont répondu à la même question. Évalue chaque réponse sur 10 (exactitude, utilité, clarté, complétude, respect de la demande). Ne favorise pas les réponses longues.

QUESTION :
${turn.user}${filesNote}

${ok.map((r, i) => `=== RÉPONSE ${letters[i]} ===\n${r.content}`).join("\n\n")}

Réponds UNIQUEMENT avec un objet JSON, sans texte autour, au format :
{"notes":[{"id":"A","note":8,"commentaire":"une phrase courte en français"}],"gagnant":"A","resume":"une phrase expliquant pourquoi le gagnant est meilleur"}`;
  turn.judge = { status: "pending", provider: judge };
  renderVerdict(turn); scrollDown();
  let out = "";
  try {
    await chatStream(judge, [{ role: "user", text: prompt }], (t) => { out += t; }, undefined, "");
    const m = out.match(/\{[\s\S]*\}/); if (!m) throw new Error("réponse de l'arbitre illisible");
    const j = JSON.parse(m[0]);
    const idx = (l) => letters.indexOf(String(l || "").trim().toUpperCase());
    const scores = {};
    for (const n of j.notes || []) { const r = ok[idx(n.id)]; if (r) scores[r.id] = { note: Math.round(Number(n.note) * 10) / 10, commentaire: n.commentaire || "" }; }
    let winner = ok[idx(j.gagnant)]?.id;
    if (!winner) winner = Object.entries(scores).sort((a, b) => b[1].note - a[1].note)[0]?.[0];
    if (!winner) throw new Error("aucune note trouvée");
    // Remplace « Réponse B » / « B » par le nom de l'IA correspondante
    const unmask = (txt) => String(txt || "").replace(/\b(?:(?:la |le )?réponse\s+)?([A-Z])\b/gi, (s, l) =>
      letters.includes(l.toUpperCase()) && (l === l.toUpperCase() || /réponse/i.test(s)) ? P(ok[idx(l)].provider).name : s);
    for (const k in scores) scores[k].commentaire = unmask(scores[k].commentaire);
    turn.judge = { status: "done", provider: judge, scores, winner, resume: unmask(j.resume) };
  } catch (e) {
    turn.judge = { status: "error", provider: judge, error: friendlyError(judge, e) };
  }
  save(); renderVerdict(turn); renderBoard(); scrollDown();
}
function renderBoard() {
  const wins = {}; let total = 0;
  for (const c of conversations) for (const t of c.turns) {
    if (t.judge?.status !== "done") continue;
    const w = t.replies.find((r) => r.id === t.judge.winner); if (!w || !P(w.provider)) continue;
    wins[w.provider] = (wins[w.provider] || 0) + 1; total++;
  }
  const board = $("#board");
  if (!total) { board.style.display = "none"; return; }
  board.style.display = "";
  const max = Math.max(...Object.values(wins));
  board.innerHTML = `<h4>🏆 Classement (${total} duel${total > 1 ? "s" : ""})</h4>` +
    Object.entries(wins).sort((a, b) => b[1] - a[1]).map(([id, n]) =>
      `<div class="b"><span>${esc(P(id).name)}</span><span class="bar"><i style="width:${n / max * 100}%;background:${P(id).color}"></i></span><span class="n">${n}</span></div>`).join("");
}

/* =====================================================================
   Réglages
   ===================================================================== */
const datalist = (id, list) => `<datalist id="${id}">${list.map((m) => `<option value="${esc(m)}">`).join("")}</datalist>`;
function openSettings(tab = "cloud", focus) {
  const head = (id, right) => `<h3><span class="dot" style="background:${P(id).color}"></span>${esc(P(id).name)}${right}</h3>`;
  $("#cloudForm").innerHTML = ORDER.filter((id) => !P(id).local).map((id) => {
    const p = P(id);
    return `<div class="prov">${head(id, `<a href="${p.keyUrl}" target="_blank" rel="noopener">Obtenir une clé ↗</a>`)}
      <div class="row"><label for="k-${id}">Clé API</label><input id="k-${id}" type="password" autocomplete="off" spellcheck="false" value="${esc(settings.keys[id] || "")}"></div>
      <div class="row"><label for="m-${id}">Modèle (texte)</label><input id="m-${id}" list="l-${id}" spellcheck="false" value="${esc(modelOf(id))}">${datalist("l-" + id, p.models)}</div>
      ${p.imageGen ? `<div class="row"><label for="im-${id}">Modèle (images)</label><input id="im-${id}" list="li-${id}" spellcheck="false" value="${esc(imageModelOf(id))}">${datalist("li-" + id, p.imageGen.models)}</div>` : ""}
      ${p.videoGen ? `<div class="row"><label for="vm-${id}">Modèle (vidéos)</label><input id="vm-${id}" list="lv-${id}" spellcheck="false" value="${esc(videoModelOf(id))}">${datalist("lv-" + id, p.videoGen.models)}</div>` : ""}
      <div class="note" style="margin-top:6px">Comprend : ${p.caps.filter((c) => c !== "youtube").map((c) => ICON[c] + " " + c).join(", ") || "texte"}${p.caps.includes("youtube") ? ", ▶ YouTube" : ""}${p.imageGen ? " · crée des images" : ""}${p.videoGen ? " · crée des vidéos" : ""}</div>
    </div>`;
  }).join("");

  $("#localForm").innerHTML = ORDER.filter((id) => P(id).local).map((id) => {
    const p = P(id);
    return `<div class="prov">${head(id, `<a href="${p.help}" target="_blank" rel="noopener">Télécharger ↗</a>`)}
      <div class="row"><label for="on-${id}">Activer</label><label><input type="checkbox" id="on-${id}" ${settings.local[id] ? "checked" : ""}> Utiliser ${esc(p.name)}</label></div>
      <div class="row"><label for="u-${id}">Adresse</label><input id="u-${id}" spellcheck="false" value="${esc(urlOf(id))}"></div>
      <div class="row"><label for="m-${id}">Modèle</label><div class="inline"><input id="m-${id}" list="l-${id}" spellcheck="false" value="${esc(modelOf(id))}" placeholder="cliquez sur Détecter">
        <button type="button" class="btn small" data-detect="${id}">Détecter</button></div>${datalist("l-" + id, p.models)}</div>
      <div class="detect" id="d-${id}"></div>
    </div>`;
  }).join("");
  document.querySelectorAll("[data-detect]").forEach((b) => b.onclick = () => detectLocal(b.dataset.detect, $("#u-" + b.dataset.detect).value, true));

  $("#routeForm").innerHTML = TASKS.map((t) => {
    const opts = ORDER.filter((id) => !t.need || can(id, t.need));
    const val = settings.routes[t.id] || t.def;
    return `<div class="row"><label for="r-${t.id}">${esc(t.label)}<small>${esc(t.hint)}</small></label>
      <select id="r-${t.id}">${opts.map((id) => `<option value="${id}" ${id === val ? "selected" : ""}>${esc(P(id).name)}${ready(id) ? "" : " (non configurée)"}</option>`).join("")}</select></div>`;
  }).join("");

  $("#judgeSel").innerHTML = `<option value="auto">Automatique (première IA disponible)</option>` + ORDER.map((id) => `<option value="${id}">${esc(P(id).name)}</option>`).join("");
  $("#judgeSel").value = settings.judge; $("#autoJudge").checked = settings.autoJudge;
  $("#sysPrompt").value = settings.system;
  showTab(tab);
  $("#settings").showModal();
  if (focus) (P(focus).local ? $("#on-" + focus) : $("#k-" + focus))?.focus();
}
function showTab(tab) {
  document.querySelectorAll("#tabs button").forEach((b) => b.classList.toggle("on", b.dataset.tab === tab));
  document.querySelectorAll(".pane").forEach((p) => p.classList.toggle("on", p.dataset.pane === tab));
}
document.querySelectorAll("#tabs button").forEach((b) => b.onclick = () => showTab(b.dataset.tab));
$("#openSettings").onclick = () => openSettings();
$("#settings").addEventListener("close", () => {
  if ($("#settings").returnValue !== "save") return;
  for (const id of ORDER) {
    const p = P(id);
    if (p.local) {
      settings.local[id] = $("#on-" + id).checked;
      settings.urls[id] = $("#u-" + id).value.trim() || p.defaultUrl;
    } else settings.keys[id] = $("#k-" + id).value.trim();
    settings.models[id] = $("#m-" + id).value.trim() || p.defaultModel;
    if (p.imageGen) settings.imageModels[id] = $("#im-" + id).value.trim() || p.imageGen.defaultModel;
    if (p.videoGen) settings.videoModels[id] = $("#vm-" + id).value.trim() || p.videoGen.defaultModel;
  }
  for (const t of TASKS) settings.routes[t.id] = $("#r-" + t.id).value;
  settings.judge = $("#judgeSel").value; settings.autoJudge = $("#autoJudge").checked;
  settings.system = $("#sysPrompt").value;
  ls.set("settings", settings);
  if (!ready(ui.single)) ui.single = ORDER.find(ready) || ui.single;
  saveUi(); renderPicker(); if (!current()) renderThread();
});

/* ---------- Détection des IA locales ---------- */
async function detectLocal(id, url, verbose) {
  url = (url || urlOf(id)).replace(/\/+$/, "");
  const out = verbose ? $("#d-" + id) : null;
  if (out) { out.className = "detect"; out.textContent = "Recherche…"; }
  try {
    const res = await fetch(id === "ollama" ? url + "/api/tags" : url + "/v1/models", { signal: AbortSignal.timeout(2500) });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const j = await res.json();
    const models = id === "ollama" ? (j.models || []).map((m) => m.name) : (j.data || []).map((m) => m.id);
    if (out) {
      out.className = "detect ok";
      out.textContent = models.length ? `✓ ${P(id).name} trouvé — ${models.length} modèle(s) : ${models.join(", ")}` : `✓ ${P(id).name} trouvé, mais aucun modèle installé${id === "ollama" ? " (tapez « ollama pull llama3.2 »)" : ""}.`;
      $("#l-" + id).innerHTML = models.map((m) => `<option value="${esc(m)}">`).join("");
      const mi = $("#m-" + id); if (models.length && !models.includes(mi.value)) mi.value = models[0];
      $("#on-" + id).checked = models.length > 0;
    }
    return models;
  } catch (e) {
    if (out) {
      out.className = "detect ko";
      out.textContent = location.protocol === "file:"
        ? `✗ Introuvable. Ouvrez Coda avec le script « lancer » (adresse http://localhost:8080) : un fichier ouvert directement ne peut pas parler à ${P(id).name}.`
        : `✗ ${P(id).name} ne répond pas à ${url}. Est-il lancé ?${id === "lmstudio" ? " Activez aussi « Enable CORS » dans le serveur de LM Studio." : ""}`;
    }
    return null;
  }
}

/* ---------- Export / import ---------- */
$("#exportBtn").onclick = () => {
  const blob = new Blob([JSON.stringify({ app: "coda", version: 2, conversations }, null, 1)], { type: "application/json" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
  a.download = `coda-conversations-${new Date().toISOString().slice(0, 10)}.json`; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
};
$("#importBtn").onclick = () => $("#importFile").click();
$("#importFile").onchange = async (e) => {
  const f = e.target.files[0]; e.target.value = ""; if (!f) return;
  try {
    const j = JSON.parse(await f.text());
    const list = (j.conversations || j).filter((c) => c && c.id && Array.isArray(c.turns));
    const known = new Set(conversations.map((c) => c.id));
    const added = list.filter((c) => !known.has(c.id));
    conversations = [...added, ...conversations];
    save(); renderList(); renderBoard();
    alert(`${added.length} conversation(s) importée(s).`);
  } catch { alert("Fichier invalide."); }
};

/* =====================================================================
   Démarrage
   ===================================================================== */
async function boot() {
  applyTheme();
  try {
    conversations = (await idb.get("conversations")) || [];
    // Reprise des conversations de la version précédente (localStorage)
    const old = ls.get("conversations", null);
    if (old && !conversations.length) { conversations = old; await idb.set("conversations", conversations); }
    if (old) localStorage.removeItem("coda:conversations");
  } catch (e) {
    console.warn("IndexedDB indisponible, historique non conservé", e);
  }
  // Réponses interrompues lors d'un rechargement de page
  for (const c of conversations) for (const t of c.turns) {
    if (t.judge?.status === "pending") t.judge = { status: "error", provider: t.judge.provider, error: "interrompu" };
    for (const r of t.replies) if (r.pending) { r.pending = false; delete r.status; if (!r.content && !r.images && !r.video) r.error = "Réponse interrompue."; }
  }
  renderPicker(); renderBoard(); renderList(); renderThread(); updateHint();

  // Détection automatique d'Ollama au premier lancement : aucun compte ni clé nécessaire
  if (settings.local.ollama === undefined && location.protocol !== "file:") {
    const models = await detectLocal("ollama");
    if (models?.length) {
      // Relit les réglages : ils ont pu changer pendant la détection (autre onglet)
      settings = { ...settings, ...ls.get("settings", {}) };
      if (settings.local.ollama !== undefined) return;
      settings.local.ollama = true;
      if (!settings.models.ollama || !models.includes(settings.models.ollama)) settings.models.ollama = models[0];
      ls.set("settings", settings);
      if (!ready(ui.single)) ui.single = "ollama";
      saveUi(); renderPicker(); if (!current()) renderThread();
    }
  }
}
boot();
