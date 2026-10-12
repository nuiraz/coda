const fs = require('fs');
const src = fs.readFileSync('/home/user/coda/worldcards/data/silhouettes.js', 'utf8');
const sils = JSON.parse(/const SILHOUETTES = (\{.*\});/s.exec(src)[1]);
function rdp(pts, eps) {
  if (pts.length < 4) return pts;
  const [a, b] = [pts[0], pts[pts.length - 1]]; let dmax = 0, idx = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const [x, y] = pts[i], dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
    const d = Math.abs(dy * x - dx * y + b[0] * a[1] - b[1] * a[0]) / L; if (d > dmax) { dmax = d; idx = i; }
  }
  if (dmax > eps) return [...rdp(pts.slice(0, idx + 1), eps).slice(0, -1), ...rdp(pts.slice(idx), eps)];
  return [a, b];
}
const out = {};
for (const [code, d] of Object.entries(sils)) {
  const anneaux = d.split(/Z/).map((s) => s.trim()).filter(Boolean);
  const res = [];
  for (const an of anneaux) {
    const pts = [...an.matchAll(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g)].map((m) => [+m[1], +m[2]]);
    let s = rdp(pts, 0.45).map(([x, y]) => [Math.round(x * 2) / 2, Math.round(y * 2) / 2]);
    s = s.filter((p, i) => i === 0 || p[0] !== s[i - 1][0] || p[1] !== s[i - 1][1]);
    // anneau minuscule (îlot) : ignoré s'il fait moins d'un point carré
    const xs = s.map((p) => p[0]), ys = s.map((p) => p[1]);
    if (s.length < 3 || (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys)) < 1.5) continue;
    res.push('M' + s.map((p) => p.join(',')).join('L') + 'Z');
  }
  out[code] = res.join('') || d;
}
const contenu = src.replace(/const SILHOUETTES = \{.*\};/s, 'const SILHOUETTES = ' + JSON.stringify(out) + ';');
fs.writeFileSync('/home/user/coda/worldcards/data/silhouettes.js', contenu);
console.log(contenu.length, 'octets');
