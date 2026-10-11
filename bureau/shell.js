"use strict";

/* Sites officiels : vous y êtes connecté avec vos propres comptes et abonnements. */
const SITES = {
  chatgpt: {
    name: "ChatGPT", color: "#10a37f", home: "https://chatgpt.com/",
    editor: ["#prompt-textarea", "div.ProseMirror[contenteditable='true']", "textarea"],
  },
  claude: {
    name: "Claude", color: "#c96442", home: "https://claude.ai/new",
    editor: ["div.ProseMirror[contenteditable='true']", "div[contenteditable='true']", "textarea"],
  },
  gemini: {
    name: "Gemini", color: "#4285f4", home: "https://gemini.google.com/app",
    editor: ["rich-textarea .ql-editor", ".ql-editor[contenteditable='true']", "div[contenteditable='true']", "textarea"],
  },
  grok: {
    name: "Grok", color: "#8a8a8a", home: "https://grok.com/",
    editor: ["textarea", "div.ProseMirror[contenteditable='true']", "div[contenteditable='true']"],
  },
};
const IDS = Object.keys(SITES);
const SEND_BUTTONS = [
  "button[data-testid='send-button']", "#composer-submit-button", "button.send-button",
  "button[aria-label*='Send' i]", "button[aria-label*='Envoyer' i]", "button[aria-label*='Submit' i]",
  "button[aria-label*='Soumettre' i]", "button[type='submit']",
];

/* Règles du mode Auto (testées dans l'ordre) */
const words = (alt) => new RegExp(`(?<![\\p{L}\\d_])(?:${alt})(?![\\p{L}\\d_])`, "iu");
const near = (a, b) => new RegExp(`(?<![\\p{L}\\d_])(?:${a})(?![\\p{L}\\d_])[^.?!\\n]{0,40}(?<![\\p{L}\\d_])(?:${b})(?![\\p{L}\\d_])`, "iu");
const MAKE = "crée|créer|cree|creer|génère|générer|genere|generer|fais|faire|réalise|réaliser|produis|anime|animer|dessine|dessiner|imagine";
const YT = /https?:\/\/(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?[^\s]*v=|shorts\/|live\/)|youtu\.be\/)[\w-]+/i;
const RULES = [
  { id: "video-gen", label: "🎬 Créer une vidéo", hint: "« crée une vidéo de… »", def: "gemini", test: (t) => near(MAKE, "vidéo|video|vidéos|videos|clip|film|animation").test(t) },
  { id: "image-gen", label: "🎨 Créer une image", hint: "« dessine… », « fais un logo… »", def: "chatgpt",
    test: (t) => /^\s*(dessine|imagine)(?![\p{L}])/iu.test(t) || near(MAKE, "images?|dessins?|illustrations?|logos?|photos?|affiches?|wallpaper|fond d'écran|portraits?|avatar").test(t) },
  { id: "video", label: "🎞️ Vidéos & YouTube", hint: "lien YouTube, « cette vidéo »…", def: "gemini", test: (t) => YT.test(t) || words("vidéo|video|youtube").test(t) },
  { id: "code", label: "💻 Programmation", hint: "code, bug, Python…", def: "claude",
    test: (t) => t.includes("```") || words("code|coder|fonction|bug|bugs|debug|script|python|javascript|typescript|java|php|sql|html|css|api|regex|algorithme|programme|programmer").test(t) },
  { id: "news", label: "📰 Actualité & réseaux sociaux", hint: "actu, news, tendances…", def: "grok",
    test: (t) => words("actu|actus|actualité|actualités|news|aujourd'hui|en ce moment|dernières? nouvelles|tendances?|twitter|tweets?|buzz|récemment|cette semaine").test(t) },
  { id: "write", label: "✍️ Rédaction & traduction", hint: "rédige, traduis, résume…", def: "claude",
    test: (t) => words("rédige|rédiger|écris|écrire|traduis|traduire|traduction|résume|résumer|reformule|corrige|lettre|e-?mail|article|poème|histoire|discours").test(t) },
  { id: "general", label: "💬 Tout le reste", hint: "questions générales", def: "chatgpt", test: () => true },
];

/* État (gardé dans ce navigateur intégré) */
const store = {
  get(k, d) { try { const v = localStorage.getItem("bureau:" + k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem("bureau:" + k, JSON.stringify(v)); } catch {} },
};
let shown = store.get("shown", IDS.slice());
let routes = store.get("routes", {});
let target = store.get("target", "all");
let solo = null;
const views = {};
const $ = (s) => document.querySelector(s);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* ---------- Panneaux ---------- */
function buildPanels() {
  const grid = $("#grid");
  for (const id of IDS) {
    const s = SITES[id];
    const panel = document.createElement("div");
    panel.className = "panel"; panel.dataset.id = id;
    panel.innerHTML = `<div class="phead"><span class="dot" style="background:${s.color}"></span><b>${s.name}</b><span class="st"></span>
      <button data-a="new" title="Nouvelle discussion">＋</button>
      <button data-a="back" title="Page précédente">←</button>
      <button data-a="reload" title="Recharger">⟳</button>
      <button data-a="solo" title="Agrandir / réduire">⤢</button>
      <button data-a="hide" title="Masquer">✕</button></div>`;
    const wv = document.createElement("webview");
    wv.setAttribute("partition", "persist:" + id); // connexion gardée entre deux lancements
    wv.setAttribute("allowpopups", "");
    wv.setAttribute("src", s.home);
    panel.appendChild(wv);
    grid.appendChild(panel);
    views[id] = wv;
    panel.querySelector(".phead").onclick = (e) => {
      const a = e.target.closest("button")?.dataset.a; if (!a) return;
      if (a === "new") wv.loadURL(s.home);
      if (a === "back" && wv.canGoBack()) wv.goBack();
      if (a === "reload") wv.reload();
      if (a === "solo") { solo = solo === id ? null : id; layout(); }
      if (a === "hide") { shown = shown.filter((x) => x !== id); if (solo === id) solo = null; store.set("shown", shown); layout(); }
    };
    wv.addEventListener("did-fail-load", (e) => { if (e.errorCode !== -3) status(id, "Chargement impossible — vérifiez votre connexion", "ko"); });
  }
}
function status(id, text, cls = "") {
  const st = document.querySelector(`.panel[data-id="${id}"] .st`);
  st.textContent = text; st.className = "st " + cls;
}
function layout() {
  const visible = solo ? [solo] : IDS.filter((id) => shown.includes(id));
  document.querySelectorAll(".panel").forEach((p) => p.classList.toggle("off", !visible.includes(p.dataset.id)));
  const n = Math.max(visible.length, 1);
  const cols = window.innerWidth < 1100 ? Math.min(n, 2) : n;
  $("#grid").style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;
  $("#chips").innerHTML = IDS.map((id) => `<button class="chip ${shown.includes(id) ? "on" : ""}" data-id="${id}"><span class="dot" style="background:${SITES[id].color}"></span>${SITES[id].name}</button>`).join(" ");
  $("#chips").querySelectorAll(".chip").forEach((c) => c.onclick = () => {
    const id = c.dataset.id;
    shown = shown.includes(id) ? shown.filter((x) => x !== id) : [...shown, id];
    if (solo && !shown.includes(solo)) solo = null;
    store.set("shown", shown); layout();
  });
}
window.addEventListener("resize", layout);
$("#allBtn").onclick = () => { solo = null; if (!shown.length) shown = IDS.slice(); store.set("shown", shown); layout(); };

/* ---------- Choix de la cible ---------- */
function renderTarget() {
  $("#target").innerHTML = `<option value="all">▦ Toutes les IA affichées</option><option value="auto">✦ Auto (selon la tâche)</option>` +
    IDS.map((id) => `<option value="${id}">${SITES[id].name}</option>`).join("");
  $("#target").value = target;
}
$("#target").onchange = () => { target = $("#target").value; store.set("target", target); if (target !== "auto" && target !== "all") { solo = target; } else solo = null; layout(); hint(); };

function forced(text) {
  const m = text.match(/^\s*@([\w-]+)\s*/); if (!m) return null;
  const k = m[1].toLowerCase();
  const id = IDS.find((x) => x === k || SITES[x].name.toLowerCase() === k || (k === "gpt" && x === "chatgpt"));
  return id ? { id, rest: text.slice(m[0].length) } : null;
}
function route(text) {
  const rule = RULES.find((r) => r.test(text));
  return { rule, id: routes[rule.id] || rule.def };
}
function plan(text) {
  const f = forced(text);
  if (f) return { ids: [f.id], text: f.rest, why: "forcé" };
  if (target === "auto") { const r = route(text); return { ids: [r.id], text, why: r.rule.label }; }
  if (target === "all") return { ids: IDS.filter((id) => shown.includes(id)), text, why: "" };
  return { ids: [target], text, why: "" };
}
function hint() {
  const text = $("#input").value;
  if (!text.trim()) { $("#hint").textContent = "Entrée pour envoyer · Maj+Entrée pour aller à la ligne · Pour joindre un fichier, glissez-le directement dans le panneau de l'IA"; return; }
  const p = plan(text);
  $("#hint").innerHTML = p.ids.length ? `→ <b>${p.ids.map((id) => esc(SITES[id].name)).join(", ")}</b>${p.why ? " · " + esc(p.why) : ""}` : "Aucune IA affichée";
  document.querySelectorAll(".panel").forEach((el) => el.classList.toggle("target", target !== "all" && p.ids.includes(el.dataset.id)));
}

/* ---------- Envoi dans chaque site ---------- */
// Exécuté DANS la page du site : trouve la zone de saisie, la vide et y place le curseur.
function focusEditorInPage(selectors) {
  for (const sel of selectors) {
    const el = [...document.querySelectorAll(sel)].find((e) => e.offsetParent !== null && !e.disabled);
    if (!el) continue;
    el.focus();
    if (el.isContentEditable) {
      const r = document.createRange(); r.selectNodeContents(el);
      const s = getSelection(); s.removeAllRanges(); s.addRange(r);
    } else if (typeof el.select === "function") el.select();
    return true;
  }
  return false;
}
function editorTextInPage(selectors) {
  for (const sel of selectors) {
    const el = [...document.querySelectorAll(sel)].find((e) => e.offsetParent !== null);
    if (el) return (el.value ?? el.innerText ?? "").trim();
  }
  return "";
}
function clickSendInPage(selectors) {
  for (const sel of selectors) {
    const b = [...document.querySelectorAll(sel)].find((e) => e.offsetParent !== null && !e.disabled);
    if (b) { b.click(); return true; }
  }
  return false;
}
const inPage = (fn, ...args) => `(${fn.toString()})(${args.map((a) => JSON.stringify(a)).join(",")})`;
function key(wv, keyCode, modifiers = []) {
  wv.sendInputEvent({ type: "keyDown", keyCode, modifiers });
  if (keyCode === "Enter") wv.sendInputEvent({ type: "char", keyCode: "\r", modifiers });
  wv.sendInputEvent({ type: "keyUp", keyCode, modifiers });
}

async function sendTo(id, text) {
  const wv = views[id], s = SITES[id];
  status(id, "Envoi…");
  wv.focus();
  const found = await wv.executeJavaScript(inPage(focusEditorInPage, s.editor));
  if (!found) throw new Error("zone de saisie introuvable — êtes-vous connecté ?");
  await sleep(60);
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (i) { key(wv, "Enter", ["shift"]); await sleep(20); }
    if (lines[i]) await wv.insertText(lines[i]);
  }
  await sleep(300);
  key(wv, "Enter");
  await sleep(900);
  // Si Entrée n'a pas suffi, on clique sur le bouton d'envoi
  if (await wv.executeJavaScript(inPage(editorTextInPage, s.editor))) {
    await wv.executeJavaScript(inPage(clickSendInPage, SEND_BUTTONS));
    await sleep(600);
    if (await wv.executeJavaScript(inPage(editorTextInPage, s.editor))) throw new Error("texte saisi, mais l'envoi n'a pas marché — appuyez sur Entrée dans le panneau");
  }
  status(id, "Envoyé ✓ " + new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }), "ok");
}

let busy = false;
async function send() {
  const raw = $("#input").value.trim();
  if (!raw || busy) return;
  const p = plan(raw);
  if (!p.ids.length) { $("#hint").textContent = "Affichez au moins une IA (boutons en haut)."; return; }
  busy = true; $("#send").disabled = true;
  if (p.ids.length === 1 && target !== "all") { solo = p.ids[0]; layout(); }
  else if (p.ids.length === 1 && !shown.includes(p.ids[0])) { solo = p.ids[0]; layout(); }
  let errors = 0;
  // Un panneau à la fois : le clavier simulé a besoin du focus
  for (const id of p.ids) {
    try { await sendTo(id, p.text); } catch (e) { errors++; status(id, "⚠ " + e.message, "ko"); }
  }
  if (!errors) { $("#input").value = ""; autosize(); }
  busy = false; $("#send").disabled = false; $("#input").focus(); hint();
}
$("#send").onclick = send;
const autosize = () => { const i = $("#input"); i.style.height = "auto"; i.style.height = Math.min(i.scrollHeight, 180) + "px"; };
$("#input").addEventListener("input", () => { autosize(); hint(); });
$("#input").addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(); } });

/* ---------- Règles Auto ---------- */
$("#rulesBtn").onclick = () => {
  $("#ruleRows").innerHTML = RULES.map((r) => `<div class="row"><label for="r-${r.id}">${esc(r.label)}<small>${esc(r.hint)}</small></label>
    <select id="r-${r.id}">${IDS.map((id) => `<option value="${id}" ${(routes[r.id] || r.def) === id ? "selected" : ""}>${SITES[id].name}</option>`).join("")}</select></div>`).join("");
  $("#rules").showModal();
};
$("#rules").addEventListener("close", () => {
  if ($("#rules").returnValue !== "save") return;
  for (const r of RULES) routes[r.id] = $("#r-" + r.id).value;
  store.set("routes", routes); hint();
});

buildPanels(); renderTarget(); layout(); hint();
if (target !== "all" && target !== "auto") { solo = target; layout(); }
$("#input").focus();
