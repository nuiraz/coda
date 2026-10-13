/* =====================================================================
   Cartes en métal réfléchissant (adapté du composant ReflectiveCard de React Bits, licence MIT).
   Chaque carte devient une plaque de graphite poli : reflets d'un studio, grain brossé,
   bord biseauté qui attrape la lumière, et un reflet qui suit la souris ou le doigt.
   Un seul moteur WebGL dessine toutes les cartes (le navigateur limite le nombre de contextes) ;
   le métal est teinté de la couleur de la carte. Sans WebGL 2, les cartes gardent leur fond actuel.
   ===================================================================== */
const METAL_VERTEX = `#version 300 es
in vec2 aPosition;
out vec2 vUv;
void main() { vUv = aPosition * 0.5 + 0.5; gl_Position = vec4(aPosition, 0.0, 1.0); }`;
// Nuanceur « PLATE » de ReflectiveCard (sans vidéo : la plaque reflète un studio doux)
const METAL_PLATE = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 fragColor;
uniform vec2 uSize; uniform float uRadius; uniform float uScale; uniform mat3 uRotate;
uniform float uBlur; uniform float uRough; uniform float uMetal; uniform vec3 uTint; uniform float uWarp; uniform float uWarpScale;
uniform float uShine; uniform float uBevel; uniform float uGlare; uniform vec2 uPointer; uniform float uSeed;
const float VIEW = 900.0;
float hash(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec2 hash2(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.103, 0.0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz) * p3.zy) * 2.0 - 1.0; }
vec3 gradientNoise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p);
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0); vec2 du = 30.0 * f * f * (f * (f - 2.0) + 1.0);
  vec2 ga = hash2(i); vec2 gb = hash2(i + vec2(1.0, 0.0)); vec2 gc = hash2(i + vec2(0.0, 1.0)); vec2 gd = hash2(i + vec2(1.0, 1.0));
  float va = dot(ga, f); float vb = dot(gb, f - vec2(1.0, 0.0)); float vc = dot(gc, f - vec2(0.0, 1.0)); float vd = dot(gd, f - vec2(1.0, 1.0));
  float k = va - vb - vc + vd; float value = va + u.x * (vb - va) + u.y * (vc - va) + u.x * u.y * k;
  vec2 slope = ga + u.x * (gb - ga) + u.y * (gc - ga) + u.x * u.y * (ga - gb - gc + gd) + du * (u.yx * k + vec2(vb, vc) - va);
  return vec3(value, slope);
}
float valueNoise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float erf(float x) { float x2 = x * x; return sign(x) * sqrt(1.0 - exp(-x2 * (1.2732395 + 0.147 * x2) / (1.0 + 0.147 * x2))); }
float band(float x, float halfWidth, float sigma) { float s = 1.4142136 * max(sigma, 0.0001); return 0.5 * (erf((x + halfWidth) / s) - erf((x - halfWidth) / s)); }
float strip(vec2 q, vec2 center, vec2 dir, float halfWidth, vec2 sigma) { vec2 normal = vec2(-dir.y, dir.x); return band(dot(q - center, normal), halfWidth, length(sigma * normal)); }
const vec2 SWEEP = vec2(0.5, 0.86);
float softbox(vec2 q, vec2 sigma) {
  float key = strip(q, vec2(-0.1, -0.16), normalize(SWEEP), 0.022, sigma + 0.018);
  float top = band(q.y + 0.6, 0.12, sigma.y + 0.05); float side = band(q.x - 0.46, 0.05, sigma.x + 0.05);
  return key + top * 0.8 + side * 0.35;
}
float room(vec2 q, vec2 sigma) {
  float fall = smoothstep(-0.55, 0.5, q.y); float flag = strip(q, vec2(0.24, -0.02), normalize(SWEEP), 0.09, sigma + 0.08);
  return mix(0.85, 0.12, fall) * (1.0 - 0.6 * flag);
}
void main() {
  vec2 p = vec2(vUv.x - 0.5, 0.5 - vUv.y) * uSize; vec2 halfSize = uSize * 0.5;
  float r = min(uRadius, min(halfSize.x, halfSize.y)); vec2 corner = abs(p) - halfSize + r;
  vec2 side = vec2(p.x >= 0.0 ? 1.0 : -1.0, p.y >= 0.0 ? 1.0 : -1.0);
  float d; vec2 outward;
  if (corner.x > 0.0 && corner.y > 0.0) { d = length(corner) - r; outward = normalize(corner) * side; }
  else if (corner.x > corner.y) { d = corner.x - r; outward = vec2(side.x, 0.0); }
  else { d = corner.y - r; outward = vec2(0.0, side.y); }
  float coverage = clamp(0.5 - d * uScale, 0.0, 1.0);
  float chamferWidth = min(uBevel, max(r, 1.0));
  float chamfer = chamferWidth > 0.01 ? 1.0 - smoothstep(0.0, chamferWidth, -d) : 0.0;
  vec2 slope = outward * chamfer;
  vec2 wp = p / (220.0 * uWarpScale) + uSeed;
  vec3 w1 = gradientNoise(wp); vec3 w2 = gradientNoise(wp * 2.07 + 13.7);
  vec2 ripple = (w1.yz + w2.yz * 0.5) * uWarp; slope += ripple * 0.008;
  float grain = valueNoise(vec2(p.x * 0.008, p.y * 0.55)) * 0.45 + valueNoise(vec2(p.x * 0.019 + 3.7, p.y * 0.23)) * 0.35 + valueNoise(vec2(p.x * 0.004 + 9.2, p.y * 0.09)) * 0.2;
  float brush = uRough * uRough; slope.y += (grain - 0.5) * brush * 0.004;
  vec3 normal = uRotate * normalize(vec3(slope, 1.0)); vec3 position = uRotate * vec3(p, 0.0);
  vec3 view = normalize(position - vec3(0.0, 0.0, VIEW)); vec3 bounce = reflect(view, normal);
  vec2 q = bounce.xy / max(bounce.z, 0.2);
  vec2 footprint = fwidth(q);
  vec2 sigma = sqrt(vec2(uBlur / VIEW) * vec2(uBlur / VIEW) + footprint * footprint * 0.5); sigma += vec2(0.004, 0.05) * uRough;
  vec3 scene = vec3(room(q, sigma)); scene *= 1.0 + (grain - 0.5) * brush * 0.3;
  vec2 toPointer = (uPointer - p) / (120.0 + uBlur * 4.0); vec2 spread = toPointer * vec2(1.0, 1.0 / (1.0 + 2.5 * uRough));
  float reach = dot(spread, spread); float glint = max(1.0 + 3.0 * dot(slope, toPointer), 0.0);
  float glare = (exp(-reach * 1.6) + exp(-reach * 0.35) * 0.15) * glint * uGlare * (1.0 + 0.8 * (grain - 0.5) * brush);
  float highlight = (softbox(q, sigma) * uShine + glare) * mix(0.4, 1.0, uMetal);
  vec3 color = vec3(0.012, 0.012, 0.016) + uTint * (scene * 0.06 * uMetal + highlight * 0.36);
  color = min(color, 0.7) + 0.3 * (1.0 - exp(-max(color - 0.7, 0.0) / 0.3));
  color = pow(clamp(color, 0.0, 1.0), vec3(1.0 / 2.2));
  color += (hash(gl_FragCoord.xy) - 0.5) / 255.0;
  fragColor = vec4(clamp(color, 0.0, 1.0) * coverage, coverage);
}`;

const MetalCartes = (() => {
  const reduit = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const glCanvas = document.createElement("canvas");
  const gl = glCanvas.getContext("webgl2", { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: true });
  let prog = null; const u = {};
  if (gl) {
    const compile = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null; };
    const vs = compile(gl.VERTEX_SHADER, METAL_VERTEX), fs = compile(gl.FRAGMENT_SHADER, METAL_PLATE);
    if (vs && fs) {
      prog = gl.createProgram(); gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.bindAttribLocation(prog, 0, "aPosition"); gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) prog = null;
    }
    if (prog) {
      const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
      const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      const n = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS);
      for (let i = 0; i < n; i++) { const inf = gl.getActiveUniform(prog, i); if (inf) u[inf.name] = gl.getUniformLocation(prog, inf.name); }
    }
  }
  if (!prog) return { actif: false };
  document.documentElement.classList.add("metal-ok");
  const rot = new Float32Array(9);
  const etats = new WeakMap();
  const GRANDES = ".detail, .pk-carte, .reveal, .hs-zoom, .carte3d, #modal .box";
  // Teinte du métal : la couleur de la carte, très éclaircie (acier légèrement coloré)
  const teinte = (card) => {
    const c = getComputedStyle(card).getPropertyValue("--c").trim() || "#8899aa";
    const m = /^#?([0-9a-f]{6})$/i.exec(c);
    const rgb = m ? [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16) / 255) : [0.55, 0.6, 0.67];
    return rgb.map((x) => Math.pow(0.55 + x * 0.45, 2.2));
  };
  function dessiner(card, e) {
    const cv = e.canvas, w = cv.width, h = cv.height;
    if (!w || !h) return;
    if (glCanvas.width < w || glCanvas.height < h) { glCanvas.width = Math.max(glCanvas.width, w); glCanvas.height = Math.max(glCanvas.height, h); }
    gl.viewport(0, 0, w, h); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); gl.useProgram(prog);
    const cx = Math.cos(e.rx), sx = Math.sin(e.rx), cy = Math.cos(e.ry), sy = Math.sin(e.ry);
    rot.set([cy, sx * sy, -cx * sy, 0, cx, sx, sy, -sx * cy, cx * cy]);
    gl.uniform2f(u.uSize, e.w, e.h); gl.uniform1f(u.uRadius, e.rayon); gl.uniform1f(u.uScale, w / Math.max(1, e.w));
    gl.uniformMatrix3fv(u.uRotate, false, rot);
    gl.uniform1f(u.uBlur, 6); gl.uniform1f(u.uRough, 0.3); gl.uniform1f(u.uMetal, 1); gl.uniform3fv(u.uTint, e.tint);
    gl.uniform1f(u.uWarp, 0.6); gl.uniform1f(u.uWarpScale, Math.max(0.3, e.w / 320)); gl.uniform1f(u.uShine, 1.15);
    gl.uniform1f(u.uBevel, Math.max(1.5, e.w / 110)); gl.uniform1f(u.uGlare, 0.6 * e.lumiere); gl.uniform2f(u.uPointer, e.px, e.py);
    gl.uniform1f(u.uSeed, e.graine);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    e.ctx.clearRect(0, 0, w, h);
    e.ctx.drawImage(glCanvas, 0, glCanvas.height - h, w, h, 0, 0, w, h);
  }
  function taille(card, e) {
    const zone = e.canvas.parentElement, dpr = Math.min(devicePixelRatio || 1, 2);
    e.w = zone.offsetWidth || 1; e.h = zone.offsetHeight || 1;
    const w = Math.max(1, Math.min(640, Math.round(e.w * dpr))), h = Math.max(1, Math.round(w * e.h / e.w));
    if (e.canvas.width !== w || e.canvas.height !== h) { e.canvas.width = w; e.canvas.height = h; }
    e.rayon = parseFloat(getComputedStyle(zone).borderTopLeftRadius) || 10;
  }
  function attacher(card) {
    if (etats.has(card) || card.classList.contains("locked")) return;
    const zone = card.querySelector(".in"); if (!zone) return;
    const canvas = document.createElement("canvas"); canvas.className = "metal-plaque"; canvas.setAttribute("aria-hidden", "true");
    zone.prepend(canvas);
    const id = card.dataset.id || "";
    let g = 0; for (const ch of id) g = (g * 31 + ch.charCodeAt(0)) % 997;
    // Au repos : légèrement penchée pour que la bande de lumière traverse la carte
    const e = { canvas, ctx: canvas.getContext("2d"), tint: teinte(card), rx: -0.06, ry: 0.12, crx: -0.06, cry: 0.12, lumiere: 0, clum: 0, px: 0, py: 0, graine: g / 97, w: 1, h: 1, rayon: 10 };
    etats.set(card, e); card.classList.add("a-metal");
    visibilite.observe(card);
  }
  const visibles = new Set(), animees = new Set();
  const visibilite = new IntersectionObserver((entrees) => {
    for (const x of entrees) {
      const card = x.target, e = etats.get(card); if (!e) continue;
      if (x.isIntersecting) { visibles.add(card); taille(card, e); dessiner(card, e); if (card.closest(".carte3d")) { animees.add(card); reveiller(); } }
      else { visibles.delete(card); animees.delete(card); }
    }
  }, { rootMargin: "120px" });
  let raf = 0, dernier = 0;
  function boucle(t) {
    raf = 0;
    const dt = Math.min(0.05, (t - dernier) / 1000 || 0.016); dernier = t;
    let encore = false;
    for (const card of [...animees]) {
      if (!card.isConnected) { animees.delete(card); visibles.delete(card); continue; }
      const e = etats.get(card); if (!e) continue;
      const c3d = card.closest(".carte3d");
      if (c3d) {
        const m = /rotateX\((-?[\d.]+)deg\) rotateY\((-?[\d.]+)deg\)/.exec(c3d.style.transform || "");
        const ry = m ? +m[2] : 0, a = Math.atan2(Math.sin(ry * Math.PI / 180), Math.cos(ry * Math.PI / 180));
        e.rx = (m ? +m[1] : 0) * Math.PI / 180 * 0.6; e.ry = Math.max(-1, Math.min(1, a)) * 0.6; e.lumiere = 0.4;
        dessiner(card, e); encore = true; continue;
      }
      const k = 1 - Math.exp(-dt * 9);
      e.rx += (e.crx - e.rx) * k; e.ry += (e.cry - e.ry) * k; e.lumiere += (e.clum - e.lumiere) * (1 - Math.exp(-dt / (e.clum > e.lumiere ? 0.18 : 0.45)));
      dessiner(card, e);
      if (Math.abs(e.crx - e.rx) + Math.abs(e.cry - e.ry) + Math.abs(e.clum - e.lumiere) < 0.002 && !card.matches(":hover")) animees.delete(card); else encore = true;
    }
    if (encore) raf = requestAnimationFrame(boucle);
  }
  function reveiller() { if (!raf && animees.size) { dernier = performance.now(); raf = requestAnimationFrame(boucle); } }
  // La plaque suit le pointeur : inclinaison et reflet
  document.addEventListener("pointermove", (ev) => {
    const card = ev.target.closest?.(".card.a-metal"); const e = card && etats.get(card);
    if (!e || reduit) return;
    if (ev.pointerType === "touch" && !ev.buttons && !card.closest(GRANDES)) return;
    const r = card.getBoundingClientRect(); if (!r.width) return;
    const nx = Math.max(-1, Math.min(1, ((ev.clientX - r.left) / r.width) * 2 - 1)), ny = Math.max(-1, Math.min(1, ((ev.clientY - r.top) / r.height) * 2 - 1));
    const a = 12 * Math.PI / 180;
    e.crx = ny * a; e.cry = -nx * a; e.clum = 1; e.px = nx * e.w * 0.5; e.py = ny * e.h * 0.5;
    animees.add(card); reveiller();
  }, { passive: true });
  const relacher = (ev) => {
    const card = ev.target.closest?.(".card.a-metal"); const e = card && etats.get(card);
    if (!e || card.contains(ev.relatedTarget)) return;
    e.crx = -0.06; e.cry = 0.12; e.clum = 0; animees.add(card); reveiller();
  };
  document.addEventListener("pointerout", relacher, { passive: true });
  document.addEventListener("pointercancel", relacher, { passive: true });
  let enAttente = false;
  const scanner = () => { enAttente = false; for (const c of document.querySelectorAll(".card:not(.a-metal):not(.locked)")) attacher(c); };
  new MutationObserver(() => { if (!enAttente) { enAttente = true; requestAnimationFrame(scanner); } }).observe(document.documentElement, { childList: true, subtree: true });
  addEventListener("resize", () => { for (const card of visibles) { const e = etats.get(card); if (e) { taille(card, e); dessiner(card, e); } } });
  scanner();
  return { actif: true };
})();
