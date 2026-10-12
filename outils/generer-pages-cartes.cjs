// Génère une page publique indexable par carte (worldcards/carte/<slug>.html), le sommaire /cartes,
// la table id → adresse (worldcards/carte/index.json) et le sitemap.
// Utilisation : node outils/extraire-cartes.cjs && node outils/generer-pages-cartes.cjs
const fs = require("fs"), path = require("path");
const RACINE = path.resolve(__dirname, "../worldcards"), SITE = "https://play2f1.com";
const { cartes, types, raretes, continents, nomPays } = require("./cartes.json");

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const slugifier = (s) => String(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/œ/g, "oe").replace(/æ/g, "ae").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const SLUG_TYPE = { pays: "pays", ville: "ville", monument: "monument", nature: "nature", animal: "animal", plat: "plat", culture: "culture", merveille: "merveille" };

// Adresses stables : le nom ; s'il est partagé par plusieurs cartes, le pays garde le nom seul et les autres reçoivent leur type
const parNom = {};
for (const c of cartes) (parNom[slugifier(c.nom)] ||= []).push(c);
const SLUG = {};
for (const [s, liste] of Object.entries(parNom)) {
  const tri = liste.slice().sort((a, b) => (a.type === "pays" ? -1 : b.type === "pays" ? 1 : 0) || a.id.localeCompare(b.id));
  const vus = new Set();
  tri.forEach((c, i) => {
    let x = liste.length === 1 || (i === 0 && c.type === "pays") ? s : `${s}-${SLUG_TYPE[c.type]}`;
    let k = 2; while (vus.has(x)) x = `${s}-${SLUG_TYPE[c.type]}-${k++}`;
    vus.add(x); SLUG[c.id] = x || slugifier(c.id);
  });
}
const paysCarte = Object.fromEntries(cartes.filter((c) => c.type === "pays").map((c) => [c.code, c]));
const deLaCarte = (c) => (c.type === "pays" ? c.code : c.pays);
const nomDuPays = (code) => nomPays[code] || code;
const lien = (c) => `/carte/${SLUG[c.id]}`;

const CSS = `:root{--bg:#111214;--panel:#18191c;--panel2:#202226;--text:#f2ede4;--muted:#9d978c;--border:#2c2e33;--accent:#ff5b35;color-scheme:dark}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:16px/1.6 "DM Sans",system-ui,-apple-system,"Segoe UI",sans-serif}
a{color:#ff8a65}header.h{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 20px;border-bottom:1px solid var(--border)}
header.h img{height:32px;display:block}.cta{display:inline-block;background:var(--accent);color:#fff;text-decoration:none;font-weight:700;padding:10px 18px;border-radius:9px}
main{max-width:980px;margin:0 auto;padding:18px 20px 40px}.fil{font-size:13px;color:var(--muted)}.fil a{color:var(--muted)}
.carte{display:grid;grid-template-columns:300px 1fr;gap:26px;align-items:start;margin-top:14px}
.visuel{border-radius:16px;overflow:hidden;background:var(--panel2);border:3px solid var(--rc);aspect-ratio:3/4;display:grid;place-items:center;position:relative}
.visuel img.photo{width:100%;height:100%;object-fit:cover}.visuel .grand{font-size:120px}.visuel img.drapeau{width:78%;border-radius:6px;box-shadow:0 8px 24px #0008}
.credit{font-size:12px;color:var(--muted);margin:6px 2px 0}.badge{display:inline-block;padding:3px 10px;border-radius:999px;font-size:13px;font-weight:700;background:var(--rc);color:#111}
h1{font:700 40px/1.1 "Bricolage Grotesque","DM Sans",system-ui,sans-serif;margin:8px 0 6px}.sous{color:var(--muted);margin:0 0 14px}
.anecdote{background:var(--panel);border-left:4px solid var(--accent);padding:12px 16px;border-radius:10px;margin:14px 0}
table{border-collapse:collapse;width:100%}td,th{padding:7px 8px;border-bottom:1px solid var(--border);text-align:left;vertical-align:top}th{color:var(--muted);font-weight:600;width:42%}
.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:14px 0}.stats div{background:var(--panel);border:1px solid var(--border);border-radius:10px;padding:10px;text-align:center}.stats b{display:block;font-size:22px}
section{margin-top:28px}h2{font:700 22px "Bricolage Grotesque","DM Sans",system-ui,sans-serif;margin:0 0 10px}
.liste{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:8px;list-style:none;padding:0;margin:0}.liste a{display:block;padding:9px 12px;background:var(--panel);border:1px solid var(--border);border-radius:9px;text-decoration:none;color:var(--text)}
.liste small{color:var(--muted)}footer{border-top:1px solid var(--border);padding:18px 20px;color:var(--muted);font-size:13px;text-align:center}
@media(max-width:720px){.carte{grid-template-columns:1fr}.visuel{max-width:320px;margin:0 auto}h1{font-size:32px}}`;
const COULEURS = { "commun": "#9aa5b4", "peu-commun": "#34d399", "rare": "#60a5fa", "epique": "#c084fc", "ultra-rare": "#fb7185", "legendaire": "#fbbf24" };

function gabarit({ titre, description, canonique, corps, jsonld, image }) {
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(titre)}</title><meta name="description" content="${esc(description)}"><link rel="canonical" href="${SITE}${canonique}">
<meta property="og:type" content="website"><meta property="og:site_name" content="Play2F1"><meta property="og:title" content="${esc(titre)}"><meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${SITE}${canonique}"><meta property="og:image" content="${SITE}${image || "/icons/icon-512.png"}"><meta name="twitter:card" content="summary">
<link rel="icon" href="/icons/logo-2f1.png" type="image/png"><meta name="theme-color" content="#111214">
<link rel="stylesheet" href="/carte.css">${jsonld ? `<script type="application/ld+json">${JSON.stringify(jsonld).replace(/</g, "\\u003c")}</script>` : ""}</head>
<body><header class="h"><a href="/"><img src="/icons/logo-site.png" alt="Play2F1" width="104" height="32"></a><a class="cta" href="/">Jouer gratuitement</a></header>
<main>${corps}</main>
<footer>Play2F1 — jeu de cartes à collectionner gratuit : pays, drapeaux, villes, monuments et merveilles du monde · <a href="/cartes">Toutes les cartes</a></footer></body></html>`;
}

function pageCarte(c) {
  const code = deLaCarte(c), pays = code ? paysCarte[code] : null, rar = raretes[c.rarete]?.nom || c.rarete, typeNom = types[c.type] || c.type;
  const cont = continents[c.continent] || (pays && continents[pays.continent]);
  const memePays = code ? cartes.filter((x) => x !== c && deLaCarte(x) === code && x.type !== "pays").sort((a, b) => (raretes[b.rarete]?.ordre ?? 0) - (raretes[a.rarete]?.ordre ?? 0) || a.nom.localeCompare(b.nom, "fr")) : [];
  const memeType = cartes.filter((x) => x !== c && x.type === c.type && x.rarete === c.rarete && deLaCarte(x) !== code).slice(0, 12);
  const desc = c.type === "pays"
    ? `Carte ${nomDuPays(c.code)} du jeu Play2F1 : drapeau, capitale ${c.capitale || ""}, anecdote et les ${memePays.length} cartes du pays (villes, monuments, nature, plats) à collectionner gratuitement.`
    : `Carte ${c.nom} (${typeNom.toLowerCase()}${code ? ", " + nomDuPays(code) : ""}) du jeu de cartes à collectionner Play2F1 : rareté ${rar}, statistiques, anecdote. Obtenez-la en ouvrant des boosters gratuits.`;
  const titre = c.type === "pays" ? `${c.nom} : carte drapeau à collectionner | Play2F1` : `${c.nom}${code ? ` (${nomDuPays(code)})` : ""} : carte ${typeNom.toLowerCase()} ${rar.toLowerCase()} | Play2F1`;
  const visuel = c.type === "pays" ? `<img class="drapeau" src="/flags/${c.code.toLowerCase()}.svg" alt="Drapeau : ${esc(c.nom)}">` : `<span class="grand" aria-hidden="true">${esc(c.emoji || "🃏")}</span>`;
  const lignes = [["Type", typeNom], ["Rareté", rar], ["Numéro", `${typeNom} n° ${String(c.num || 0).padStart(3, "0")}`],
    c.type === "pays" && c.capitale ? ["Capitale", c.capitale] : null, code && c.type !== "pays" ? ["Pays", pays ? `<a href="${lien(pays)}">${esc(pays.nom)}</a>` : esc(nomDuPays(code))] : null,
    cont ? ["Continent", `${cont.emoji || ""} ${cont.nom}`] : null, c.lat !== null && c.lon !== null ? ["Coordonnées", `${Math.abs(c.lat).toFixed(2)}° ${c.lat >= 0 ? "N" : "S"}, ${Math.abs(c.lon).toFixed(2)}° ${c.lon >= 0 ? "E" : "O"}`] : null,
    c.talent ? ["Talent en combat", c.talent] : null, c.special ? ["Attaque spéciale", c.special] : null].filter(Boolean);
  const fil = [["Accueil", "/"], ["Toutes les cartes", "/cartes"], ...(pays && c.type !== "pays" ? [[pays.nom, lien(pays)]] : []), [c.nom, null]];
  const corps = `<nav class="fil">${fil.map(([n, h]) => (h ? `<a href="${h}">${esc(n)}</a>` : `<span>${esc(n)}</span>`)).join(" › ")}</nav>
<article class="carte" style="--rc:${COULEURS[c.rarete] || "#888"}">
  <div><div class="visuel" id="visuel"${c.wiki && c.type !== "pays" ? ` data-wiki="${esc(c.wiki)}"` : ""}>${visuel}</div><p class="credit" id="credit"></p></div>
  <div><span class="badge">${esc(rar)}</span>
    <h1>${esc(c.nom)}</h1><p class="sous">Carte ${esc(typeNom.toLowerCase())} du jeu Play2F1${code && c.type !== "pays" ? ` · ${esc(nomDuPays(code))}` : ""}</p>
    ${c.anecdote ? `<p class="anecdote">💡 ${esc(c.anecdote)}</p>` : ""}
    <div class="stats"><div><b>${c.atk}</b>⚔️ Attaque</div><div><b>${c.def}</b>🛡️ Défense</div><div><b>${c.pv}</b>❤️ Vie</div></div>
    <table>${lignes.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${/<a /.test(v) ? v : esc(v)}</td></tr>`).join("")}</table>
    <p style="margin-top:16px">Comment l'obtenir : ouvrez des boosters (un booster gratuit toutes les 12 heures), fabriquez-la avec de la poussière d'étoiles ou échangez-la avec un autre joueur.</p>
    <a class="cta" href="/#codex">Voir la carte dans le jeu</a></div>
</article>
${memePays.length ? `<section><h2>${c.type === "pays" ? `Les ${memePays.length} cartes de ${esc(c.nom)}` : `Autres cartes : ${esc(nomDuPays(code))}`}</h2><ul class="liste">${memePays.slice(0, c.type === "pays" ? 400 : 24).map((x) => `<li><a href="${lien(x)}">${esc(x.nom)} <small>· ${esc(types[x.type])}, ${esc(raretes[x.rarete]?.nom || "")}</small></a></li>`).join("")}</ul></section>` : ""}
${memeType.length ? `<section><h2>Autres cartes ${esc(typeNom.toLowerCase())} ${esc(rar.toLowerCase())}</h2><ul class="liste">${memeType.map((x) => `<li><a href="${lien(x)}">${esc(x.nom)} <small>· ${esc(nomDuPays(deLaCarte(x)) || "")}</small></a></li>`).join("")}</ul></section>` : ""}
${c.wiki && c.type !== "pays" ? `<script src="/carte.js" defer></script>` : ""}`;
  const jsonld = { "@context": "https://schema.org", "@graph": [
    { "@type": "BreadcrumbList", itemListElement: fil.map(([n, h], i) => ({ "@type": "ListItem", position: i + 1, name: n, ...(h ? { item: SITE + h } : {}) })) },
    { "@type": "WebPage", name: titre, description: desc, url: SITE + lien(c), isPartOf: { "@type": "WebSite", name: "Play2F1", url: SITE + "/" },
      about: { "@type": c.type === "pays" ? "Country" : c.type === "ville" ? "City" : "Thing", name: c.type === "pays" ? nomDuPays(c.code) : c.nom } },
  ] };
  return gabarit({ titre, description: desc, canonique: lien(c), corps, jsonld });
}

function pageSommaire() {
  const parCont = {};
  for (const p of cartes.filter((c) => c.type === "pays")) (parCont[p.continent] ||= []).push(p);
  const nb = (code) => cartes.filter((x) => deLaCarte(x) === code).length;
  const merveilles = cartes.filter((c) => c.type === "merveille");
  const corps = `<nav class="fil"><a href="/">Accueil</a> › <span>Toutes les cartes</span></nav>
<h1>Toutes les cartes Play2F1</h1><p class="sous">${cartes.length} cartes à collectionner : les 195 pays et leurs drapeaux, des villes, des monuments, la nature, les animaux, la gastronomie et la culture du monde entier. Choisissez un pays pour voir toutes ses cartes.</p>
${merveilles.length ? `<section><h2>🌟 Merveilles du monde</h2><ul class="liste">${merveilles.map((m) => `<li><a href="${lien(m)}">${esc(m.nom)}</a></li>`).join("")}</ul></section>` : ""}
${Object.entries(parCont).map(([k, liste]) => `<section><h2>${esc(continents[k]?.emoji || "")} ${esc(continents[k]?.nom || k)}</h2><ul class="liste">${liste.sort((a, b) => a.nom.localeCompare(b.nom, "fr")).map((p) => `<li><a href="${lien(p)}">${esc(p.nom)} <small>· ${nb(p.code)} cartes</small></a></li>`).join("")}</ul></section>`).join("")}`;
  return gabarit({ titre: "Toutes les cartes à collectionner : pays, villes, monuments | Play2F1", description: `Les ${cartes.length} cartes du jeu Play2F1 classées par continent et par pays : drapeaux, villes, monuments, nature, animaux, plats et merveilles du monde.`, canonique: "/cartes", corps,
    jsonld: { "@context": "https://schema.org", "@type": "CollectionPage", name: "Toutes les cartes Play2F1", url: SITE + "/cartes" } });
}

const dossier = path.join(RACINE, "carte");
fs.rmSync(dossier, { recursive: true, force: true });
fs.mkdirSync(dossier, { recursive: true });
for (const c of cartes) fs.writeFileSync(path.join(dossier, SLUG[c.id] + ".html"), pageCarte(c));
fs.writeFileSync(path.join(RACINE, "cartes.html"), pageSommaire());
fs.writeFileSync(path.join(RACINE, "carte.css"), CSS);
// Photo Wikimedia chargée dans le navigateur, avec son auteur et sa licence (comme dans le jeu)
fs.writeFileSync(path.join(RACINE, "carte.js"), `(async () => {
  const v = document.getElementById("visuel"), t = v && v.dataset.wiki; if (!t) return;
  try {
    const r = await fetch("https://fr.wikipedia.org/w/api.php?action=query&prop=pageimages&piprop=thumbnail|name&pithumbsize=640&format=json&origin=*&titles=" + encodeURIComponent(t));
    const p = Object.values((await r.json()).query.pages)[0]; if (!p || !p.thumbnail) return;
    const f = p.pageimage;
    const m = await fetch("https://commons.wikimedia.org/w/api.php?action=query&prop=imageinfo&iiprop=extmetadata&format=json&origin=*&titles=File:" + encodeURIComponent(f)).then((x) => x.json()).catch(() => null);
    const e = m && Object.values(m.query.pages)[0].imageinfo?.[0]?.extmetadata;
    const txt = (s) => { const d = document.createElement("div"); d.innerHTML = s || ""; return d.textContent.trim(); };
    if (v.dataset.legende === undefined) { const img = document.createElement("img"); img.className = "photo"; img.alt = ""; img.src = p.thumbnail.source; v.replaceChildren(img); }
    const c = document.getElementById("credit"); c.textContent = "Photo" + (v.dataset.legende ? " " + v.dataset.legende : "") + " : " + (e ? txt(e.Artist?.value) + ", " + txt(e.LicenseShortName?.value) : "Wikimedia Commons") + " — ";
    const a = document.createElement("a"); a.href = "https://commons.wikimedia.org/wiki/File:" + encodeURIComponent(f); a.rel = "nofollow"; a.textContent = "source et licence"; c.append(a);
  } catch {}
})();
`);
fs.writeFileSync(path.join(dossier, "index.json"), JSON.stringify(SLUG));
const jour = new Date().toISOString().slice(0, 10);
fs.writeFileSync(path.join(RACINE, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${SITE}/</loc><lastmod>${jour}</lastmod><priority>1.0</priority></url>
  <url><loc>${SITE}/cartes</loc><lastmod>${jour}</lastmod><priority>0.9</priority></url>
${cartes.map((c) => `  <url><loc>${SITE}${lien(c)}</loc><lastmod>${jour}</lastmod><priority>${c.type === "pays" ? "0.8" : "0.6"}</priority></url>`).join("\n")}
</urlset>
`);
console.log(cartes.length, "pages de cartes générées,", new Set(Object.values(SLUG)).size, "adresses uniques");
