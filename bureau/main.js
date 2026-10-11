"use strict";
// Coda Bureau : affiche les sites officiels des IA (avec vos comptes et abonnements) dans une seule fenêtre.
const { app, BrowserWindow, shell } = require("electron");
const path = require("path");

// User-agent d'un Chrome classique : sinon Google refuse la connexion (« navigateur non sécurisé »).
const OS = process.platform === "darwin" ? "Macintosh; Intel Mac OS X 10_15_7"
  : process.platform === "win32" ? "Windows NT 10.0; Win64; x64" : "X11; Linux x86_64";
app.userAgentFallback = `Mozilla/5.0 (${OS}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${process.versions.chrome.split(".")[0]}.0.0.0 Safari/537.36`;

// Fenêtres de connexion autorisées à s'ouvrir dans l'application ; le reste s'ouvre dans votre navigateur.
const AUTH = /^https:\/\/([\w-]+\.)*(google\.com|apple\.com|microsoftonline\.com|live\.com|openai\.com|chatgpt\.com|claude\.ai|anthropic\.com|grok\.com|x\.ai|x\.com|twitter\.com)(\/|$)/;

function createWindow() {
  const win = new BrowserWindow({
    width: 1600, height: 1000, minWidth: 700, minHeight: 500,
    title: "Coda Bureau", backgroundColor: "#1c1c1a",
    webPreferences: { webviewTag: true, contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  win.loadFile(path.join(__dirname, "shell.html"));
}

app.on("web-contents-created", (_e, contents) => {
  // Les panneaux (webviews) ne reçoivent jamais de droits Node.js
  contents.on("will-attach-webview", (e, prefs, params) => {
    delete prefs.preload;
    prefs.nodeIntegration = false;
    prefs.contextIsolation = true;
    if (!/^https:\/\//.test(params.src)) e.preventDefault();
  });
  if (contents.getType() === "webview") {
    contents.setWindowOpenHandler(({ url }) => {
      if (AUTH.test(url)) return { action: "allow" };
      if (/^https?:\/\//.test(url)) shell.openExternal(url);
      return { action: "deny" };
    });
  } else {
    // La fenêtre principale ne quitte jamais l'interface Coda
    contents.on("will-navigate", (e) => e.preventDefault());
  }
});

app.whenReady().then(createWindow);
app.on("window-all-closed", () => app.quit());
app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
