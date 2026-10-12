// Construit worldcards/jeu.min.js : tous les scripts du jeu (liste dans worldcards/scripts.json), mis bout à bout puis minifiés.
// Un seul fichier compressé au lieu d'une trentaine : la page s'affiche plus vite, surtout sur mobile.
// Utilisation : node outils/construire.cjs   (nécessite esbuild : npm i -g esbuild, ou ESBUILD_PATH=/chemin/vers/esbuild)
// À relancer après chaque modification d'un fichier .js du jeu, avant de publier.
const fs = require("fs"), path = require("path"), crypto = require("crypto");
const racine = path.join(__dirname, "..", "worldcards");
const fichiers = JSON.parse(fs.readFileSync(path.join(racine, "scripts.json"), "utf8"));
const esbuild = require(process.env.ESBUILD_PATH || "esbuild");
// Chaque fichier est séparé par « ; » : un fichier qui ne finit pas par un point-virgule ne peut pas se coller au suivant
const source = '"use strict";\n' + fichiers.map((f) => `/* ${f} */\n` + fs.readFileSync(path.join(racine, f), "utf8").replace(/^"use strict";\s*/, "")).join("\n;\n");
const { code } = esbuild.transformSync(source, { minify: true, target: "es2020", charset: "utf8", legalComments: "none" });
fs.writeFileSync(path.join(racine, "jeu.min.js"), code);
const empreinte = crypto.createHash("sha256").update(code).digest("hex").slice(0, 10);
// Feuilles de style : style.css puis eclat.css, réunies et minifiées dans site.min.css
const css = ["style.css", "eclat.css"].map((f) => fs.readFileSync(path.join(racine, f), "utf8")).join("\n");
const cssMin = esbuild.transformSync(css, { loader: "css", minify: true, target: ["chrome100", "safari15", "firefox100"], charset: "utf8" }).code;
fs.writeFileSync(path.join(racine, "site.min.css"), cssMin);
const empreinteCss = crypto.createHash("sha256").update(cssMin).digest("hex").slice(0, 10);
// La page charge jeu.min.js?v=<empreinte> et site.min.css?v=<empreinte> : le navigateur prend toujours la dernière version
const index = path.join(racine, "index.html");
const html = fs.readFileSync(index, "utf8").replace(/jeu\.min\.js\?v=[\w]+/g, `jeu.min.js?v=${empreinte}`).replace(/site\.min\.css\?v=[\w]+/g, `site.min.css?v=${empreinteCss}`);
fs.writeFileSync(index, html);
console.log(`jeu.min.js : ${fichiers.length} fichiers, ${(source.length / 1024).toFixed(0)} Ko → ${(code.length / 1024).toFixed(0)} Ko (v=${empreinte})`);
console.log(`site.min.css : ${(css.length / 1024).toFixed(0)} Ko → ${(cssMin.length / 1024).toFixed(0)} Ko (v=${empreinteCss})`);
