(async () => {
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
