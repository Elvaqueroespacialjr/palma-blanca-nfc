/* =====================================================================
   PALMA BLANCA · MODO ANTRO
   Selfie de entrada, ruleta con casilla especial y el muro de
   fotos (se borran solas a las 24 h). Las casillas están en antro-data.js.
   La app llama a window.__antroExt(...) al abrir el Modo Antro.
   ===================================================================== */
window.__antroExt = function (T) {
"use strict";
const { S, save, sumar, log, toast, go, VIEWS, nav, cabecera, pie, app, CONFIG, ASSET, esc, emph, rival, flush } = T;
const $ = s => document.querySelector(s);
const AD = window.ANTRO_DATA || { casillas: [] };
/* En Netlify (o en pruebas locales) el muro está en el mismo sitio; desde el link de claude.ai se llama a Netlify. */
const BASE = /(^|\.)palma-blanca-nfc\.netlify\.app$|^localhost$|^127\.0\.0\.1$/.test(location.hostname) ? "" : "https://palma-blanca-nfc.netlify.app";
const API = BASE + "/api/fotos";
const DAY = 864e5;
const tm = $("#tm");
const reduce = () => !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);

/* ---------- Vibración y sonido ---------- */
function vib(p) { try { const ua = navigator.userActivation; if (navigator.vibrate && (!ua || ua.hasBeenActive)) navigator.vibrate(p); } catch (e) {} }
let ac = null;
function actx() { if (!ac) { try { const C = window.AudioContext || window.webkitAudioContext; if (C) ac = new C(); } catch (e) {} } try { if (ac && ac.state === "suspended") ac.resume(); } catch (e) {} return ac; }
function tone(freq, dur, type, vol, delay) {
  if (!ac) return;
  try {
    const t = ac.currentTime + (delay || 0), o = ac.createOscillator(), g = ac.createGain();
    o.type = type || "sine"; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol || 0.12, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + dur + 0.03);
  } catch (e) {}
}
const PASO = ["Sin presión: pasar también se vale.", "Paso aceptado. Un trago de agua y seguimos.", "Nadie está obligado a tomar. ¡Siguiente!"];
const passToast = () => toast(PASO[Math.floor(Math.random() * PASO.length)]);

function cargar(src) { return new Promise((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = ko; i.src = src; }); }
function lock(on) { document.body.classList.toggle("lock", !!on); }

/* ---------- Aviso (confirmación) ---------- */
function avisar(texto, siTxt, noTxt, extraHTML) {
  return new Promise(res => {
    const ov = document.createElement("div"); ov.className = "aviso"; ov.setAttribute("role", "dialog"); ov.setAttribute("aria-modal", "true");
    ov.innerHTML = `<div class="aviso-c"><p>${texto}</p>${extraHTML || ""}<button class="btn btn-gold" data-a="si">${esc(siTxt)}</button>${noTxt ? `<button class="btn btn-line" data-a="no">${esc(noTxt)}</button>` : ""}</div>`;
    tm.appendChild(ov);
    const inp = ov.querySelector("input"); if (inp) setTimeout(() => inp.focus(), 50);
    ov.addEventListener("click", e => {
      const b = e.target.closest("[data-a]"); if (!b && e.target !== ov) return;
      const si = !!b && b.dataset.a === "si"; const val = inp ? inp.value : null; ov.remove(); res(si ? (inp ? val : true) : false);
    });
  });
}

/* =====================================================================
   CÁMARA (selfie y fotos de grupo). Si no hay permiso, no truena.
   ===================================================================== */
function camara(o) {
  let stream = null, face = o.facing || "user", shot = null, alive = true;
  const ov = document.createElement("div"); ov.className = "cam"; ov.setAttribute("role", "dialog"); ov.setAttribute("aria-modal", "true");
  ov.innerHTML = `<div class="cam-top">${o.onAtras ? `<button type="button" class="atras-antro" data-c="atras">${esc(o.atrasTxt || "‹ Atrás")}</button>` : ""}${o.sub ? `<div class="cond gold cam-k">${esc(o.sub)}</div>` : ""}<h1 class="h-lg">${esc(o.titulo)}</h1>${o.nota ? `<p class="small" style="margin-top:6px">${esc(o.nota)}</p>` : ""}</div>
    <div class="cam-view"><video playsinline muted autoplay></video><canvas hidden></canvas><div class="cam-msg" hidden></div></div>
    <div class="cam-acts"></div>`;
  tm.appendChild(ov); lock(true);
  const v = ov.querySelector("video"), cv = ov.querySelector("canvas"), msg = ov.querySelector(".cam-msg"), acts = ov.querySelector(".cam-acts");
  const file = document.createElement("input"); file.type = "file"; file.accept = "image/*"; file.hidden = true; ov.appendChild(file);
  const cancelTxt = esc(o.cancelTxt || "Cancelar");
  const stop = () => { if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; } };
  const close = () => { alive = false; stop(); ov.remove(); lock(false); };
  const setActs = h => { acts.innerHTML = h; };
  const liveActs = () => setActs(`<button class="btn btn-gold" data-c="tomar">Tomar foto</button><div class="row2"><button class="btn btn-line" data-c="voltear">Voltear</button><button class="btn btn-line" data-c="cancel">${cancelTxt}</button></div>`);
  const reviewActs = () => setActs(`<button class="btn btn-gold" data-c="usar">${esc(o.usarTxt || "Usar esta foto")}</button><div class="row2"><button class="btn btn-line" data-c="repetir">Repetir</button><button class="btn btn-line" data-c="cancel">${cancelTxt}</button></div>`);
  function fail(t) {
    stop(); v.hidden = true; cv.hidden = true; msg.hidden = false; msg.textContent = t;
    setActs(`<button class="btn btn-gold" data-c="cancel">${cancelTxt}</button><button class="btn btn-line" data-c="archivo">Intentar con la cámara del cel</button>`);
  }
  async function start() {
    shot = null; msg.hidden = true; cv.hidden = true; v.hidden = false; stop();
    file.setAttribute("capture", face === "user" ? "user" : "environment");
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { fail("Este navegador no deja abrir la cámara aquí. No pasa nada: puedes seguir sin foto."); return; }
    setActs(`<p class="small" style="text-align:center">Abriendo la cámara…</p><button class="btn btn-line" data-c="cancel">${cancelTxt}</button>`);
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: face, width: { ideal: 1440 }, height: { ideal: 1440 } }, audio: false });
      if (!alive) { s.getTracks().forEach(t => t.stop()); return; }
      stream = s; v.srcObject = s; v.classList.toggle("mirror", face === "user");
      try { await v.play(); } catch (e) {}
      liveActs();
    } catch (e) {
      const negado = e && (e.name === "NotAllowedError" || e.name === "SecurityError" || e.name === "PermissionDeniedError");
      fail(negado
        ? "No nos diste permiso de usar la cámara. No pasa nada: puedes seguir sin foto, o darle permiso desde los ajustes de tu navegador."
        : "No pudimos abrir la cámara de este cel. No pasa nada: puedes seguir sin foto.");
    }
  }
  function capture() {
    const w = v.videoWidth, h = v.videoHeight; if (!w || !h) { toast("La cámara todavía no está lista."); return; }
    cv.width = w; cv.height = h; const x = cv.getContext("2d");
    if (face === "user") { x.translate(w, 0); x.scale(-1, 1); }
    x.drawImage(v, 0, 0, w, h); x.setTransform(1, 0, 0, 1, 0, 0);
    stop(); v.hidden = true; cv.hidden = false; shot = cv;
    actx(); vib(30); tone(1500, 0.05, "square", 0.05); reviewActs();
  }
  ov.querySelector(".cam-top").addEventListener("click", e => { if (e.target.closest("[data-c=atras]")) { close(); o.onAtras && o.onAtras(); } });
  acts.addEventListener("click", e => {
    const b = e.target.closest("[data-c]"); if (!b) return; const c = b.dataset.c;
    if (c === "tomar") capture();
    else if (c === "repetir") start();
    else if (c === "voltear") { face = face === "user" ? "environment" : "user"; start(); }
    else if (c === "usar") { const src = shot; close(); o.onFoto && o.onFoto(src); }
    else if (c === "archivo") file.click();
    else if (c === "cancel") { close(); o.onCancel && o.onCancel(); }
  });
  file.onchange = async () => {
    const f = file.files && file.files[0]; if (!f) return;
    try { const img = await cargar(URL.createObjectURL(f)); shot = img; v.hidden = true; msg.hidden = true; cv.hidden = false;
      cv.width = img.naturalWidth; cv.height = img.naturalHeight; cv.getContext("2d").drawImage(img, 0, 0); shot = cv; reviewActs();
    } catch (err) { toast("No se pudo leer esa foto."); }
  };
  start();
  return { close };
}

/* =====================================================================
   MARCO PREMIUM: logo, nombre de la foto, fecha y hora
   ===================================================================== */
const MES = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];
function fmtFecha(d) {
  let h = d.getHours(); const ap = h < 12 ? "AM" : "PM"; h = h % 12 || 12;
  return `${d.getDate()} ${MES[d.getMonth()]} ${d.getFullYear()} · ${h}:${String(d.getMinutes()).padStart(2, "0")} ${ap}`;
}
function fitFont(x, text, weight, size, family, maxW, min) {
  let s = size; x.font = `${weight} ${s}px ${family}`;
  while (x.measureText(text).width > maxW && s > min) { s -= 2; x.font = `${weight} ${s}px ${family}`; }
}
async function marcoFoto(src, nick, fecha) {
  try { await Promise.all([document.fonts.load("800 72px 'Barlow Condensed'"), document.fonts.load("700 34px 'Barlow Condensed'"), document.fonts.load("500 20px Montserrat")]); } catch (e) {}
  const W = 1080, H = 1440, c = document.createElement("canvas"); c.width = W; c.height = H; const x = c.getContext("2d");
  const bg = x.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, "#13244b"); bg.addColorStop(1, "#0b1630"); x.fillStyle = bg; x.fillRect(0, 0, W, H);
  const M = 56, PW = W - 2 * M, PY = 56, PH = 1100;
  const sw = src.videoWidth || src.naturalWidth || src.width, sh = src.videoHeight || src.naturalHeight || src.height;
  const s = Math.max(PW / sw, PH / sh), dw = sw * s, dh = sh * s;
  x.save(); x.beginPath(); x.rect(M, PY, PW, PH); x.clip();
  x.drawImage(src, M + (PW - dw) / 2, PY + (PH - dh) / 2, dw, dh);
  const vg = x.createLinearGradient(0, PY + PH - 240, 0, PY + PH); vg.addColorStop(0, "rgba(11,22,48,0)"); vg.addColorStop(1, "rgba(11,22,48,.45)");
  x.fillStyle = vg; x.fillRect(M, PY + PH - 240, PW, 240); x.restore();
  // Doble filete dorado
  x.strokeStyle = "#c9a46a"; x.lineWidth = 3; x.strokeRect(M - 16, PY - 16, PW + 32, PH + 32);
  x.strokeStyle = "rgba(201,164,106,.45)"; x.lineWidth = 1.5; x.strokeRect(M - 28, PY - 28, PW + 56, PH + 56);
  // Esquinas en rombo
  x.fillStyle = "#c9a46a";
  [[M - 16, PY - 16], [M + PW + 16, PY - 16], [M - 16, PY + PH + 16], [M + PW + 16, PY + PH + 16]].forEach(([cx, cy]) => { x.beginPath(); x.moveTo(cx, cy - 9); x.lineTo(cx + 9, cy); x.lineTo(cx, cy + 9); x.lineTo(cx - 9, cy); x.closePath(); x.fill(); });
  // Banda inferior
  const by = PY + PH + 58;
  let lw = 0;
  try { const lg = await cargar(ASSET.logo); const lh = 150; lw = lg.width * lh / lg.height; x.drawImage(lg, M - 4, by, lw, lh); } catch (e) {}
  x.fillStyle = "#c9a46a"; x.fillRect(M + lw + 26, by + 14, 2, 122);
  const tx = W - M, maxW = W - M - (M + lw + 60);
  x.textAlign = "right"; x.textBaseline = "alphabetic";
  x.fillStyle = "#f6f2e8"; fitFont(x, nick.toUpperCase(), 800, 76, "'Barlow Condensed',sans-serif", maxW, 40); x.fillText(nick.toUpperCase(), tx, by + 70);
  try { x.letterSpacing = "3px"; } catch (e) {}
  x.fillStyle = "#c9a46a"; x.font = "700 34px 'Barlow Condensed',sans-serif"; x.fillText(fecha, tx, by + 116);
  try { x.letterSpacing = "2px"; } catch (e) {}
  x.fillStyle = "rgba(246,242,232,.55)"; x.font = "500 19px Montserrat,sans-serif"; x.fillText("MODO ANTRO · EVITE EL EXCESO", tx, by + 150);
  return await new Promise(r => c.toBlob(r, "image/jpeg", 0.86));
}

/* =====================================================================
   MURO: subir, listar y borrar (el servidor borra todo a las 24 h)
   ===================================================================== */
const TK = "pb_muro_tokens";
function tokens() { try { return JSON.parse(localStorage.getItem(TK) || "{}") || {}; } catch (e) { return {}; } }
function setTokens(t) { try { localStorage.setItem(TK, JSON.stringify(t)); } catch (e) {} }
function newToken() { const a = new Uint8Array(24); crypto.getRandomValues(a); return Array.from(a, b => b.toString(16).padStart(2, "0")).join(""); }
let staffPin = (() => { try { return sessionStorage.getItem("pb_staff") || ""; } catch (e) { return ""; } })();

async function subir(blob, tipo) {
  const token = newToken();
  const r = await fetch(API, { method: "POST", headers: { "content-type": "image/jpeg", "x-token": token, "x-nick": encodeURIComponent(S.nombre || ""), "x-tipo": tipo, "x-device": S.device || "" }, body: blob });
  if (!r.ok) throw new Error("http " + r.status);
  const d = await r.json(); const t = tokens(); t[d.id] = token;
  Object.keys(t).forEach(k => { if (Date.now() - Number(k.split("-")[0]) > DAY) delete t[k]; });
  setTokens(t); log("foto_muro", tipo); return d;
}
const ETIQUETA = { selfie: "Selfie de la noche", ruleta: "La ruleta", muro: "Foto de la noche" };
const nombreFoto = (nick, tipo) => (nick && nick !== "Anónimo") ? nick : (ETIQUETA[tipo] || ETIQUETA.muro);
async function publicar(src, tipo) {
  let blob = null;
  try { blob = await marcoFoto(src, nombreFoto(S.nombre, tipo), fmtFecha(new Date())); } catch (e) { return { ok: false, blob: null }; }
  try { const d = await subir(blob, tipo); return { ok: true, blob, d }; } catch (e) { return { ok: false, blob }; }
}
/* Sube con pantalla de "subiendo" y luego muestra el resultado */
async function publicarUI(src, tipo) {
  const ov = document.createElement("div"); ov.className = "aviso";
  ov.innerHTML = `<div class="aviso-c" style="align-items:center;text-align:center"><div class="spin" aria-hidden="true"></div><p>Poniéndole el marco y subiéndola al muro…</p></div>`;
  tm.appendChild(ov);
  const r = await publicar(src, tipo); ov.remove();
  if (r.ok) { vib([40, 40, 120]); actx(); tone(880, .12, "sine", .1); tone(1320, .18, "sine", .1, .1); }
  verResultado(r);
  return r;
}
function verResultado(r) {
  const ov = document.createElement("div"); ov.className = "aviso"; ov.setAttribute("role", "dialog"); ov.setAttribute("aria-modal", "true");
  const url = r.blob ? URL.createObjectURL(r.blob) : "";
  ov.innerHTML = `<div class="aviso-c res-foto">
    ${url ? `<img src="${url}" alt="Tu foto con el marco de Palma Blanca">` : ""}
    <p>${r.ok ? "<b>¡Ya está en el muro!</b> Se borra sola en 24 horas, o antes si tú la borras." : "No se pudo subir al muro. Revisa tu señal e inténtalo otra vez. Mientras, puedes compartirla desde tu cel."}</p>
    ${url ? `<button class="btn btn-gold" data-a="share">Compartir en tu historia</button>` : ""}
    <div class="row2">${r.ok ? `<button class="btn btn-line" data-a="muro">Ver el muro</button>` : url ? `<a class="btn btn-line" href="${url}" download="palma-blanca.jpg" data-a="save">Guardar</a>` : ""}<button class="btn btn-line" data-a="x"${!r.ok && !url ? ' style="grid-column:1/-1"' : ""}>Cerrar</button></div>
  </div>`;
  tm.appendChild(ov);
  ov.addEventListener("click", async e => {
    const b = e.target.closest("[data-a]"); if (!b) return; const a = b.dataset.a;
    if (a === "share") {
      const f = new File([r.blob], "palma-blanca.jpg", { type: "image/jpeg" });
      try { if (navigator.canShare && navigator.canShare({ files: [f] })) { await navigator.share({ files: [f], text: "@" + CONFIG.instagram }); return; } } catch (err) { if (err && err.name === "AbortError") return; }
      const a2 = document.createElement("a"); a2.href = url; a2.download = "palma-blanca.jpg"; document.body.appendChild(a2); a2.click(); a2.remove();
      return;
    }
    if (a === "save") return;
    ov.remove(); if (a === "muro") go("muro"); else if (!$("#tm .ov")) lock(false);
  });
}

function restante(ms) {
  if (ms <= 0) return "se está borrando";
  const h = Math.floor(ms / 36e5); if (h >= 1) return `se borra en ${h} h`;
  return `se borra en ${Math.max(1, Math.ceil(ms / 6e4))} min`;
}
function hace(ms) {
  const m = Math.floor(ms / 6e4); if (m < 1) return "ahora"; if (m < 60) return `hace ${m} min`;
  return `hace ${Math.floor(m / 60)} h`;
}
let muroData = null, muroTimer = null, muroTick = null, muroSkew = 0;
function pintarMuro() {
  const box = $("#muro"); if (!box) return;
  if (muroData === null) return;
  const now = Date.now() + muroSkew, mine = tokens();
  const list = muroData.filter(f => f.exp > now);
  if (!list.length) { box.innerHTML = `<div class="muro-vacio"><b>Todavía no hay fotos</b><span>Sé el primero en subir una. Se borra sola en 24 horas.</span></div>`; return; }
  box.innerHTML = list.map(f => `<article class="post">
      <div class="post-h"><b>${esc(nombreFoto(f.nick, f.tipo))}</b><span>${hace(now - f.ts)}</span></div>
      <img src="${esc(BASE + f.url)}" alt="${esc(nombreFoto(f.nick, f.tipo))} en el muro de Palma Blanca" loading="lazy" decoding="async">
      <div class="post-f"><span class="post-t">⏳ ${restante(f.exp - now)}</span>${mine[f.id] || staffPin ? `<button class="post-del" data-del="${esc(f.id)}">${mine[f.id] ? "Borrar mi foto" : "Quitar (staff)"}</button>` : ""}</div>
    </article>`).join("");
}
async function cargarMuro(silencioso) {
  const box = $("#muro"); if (!box) return;
  if (!silencioso && muroData === null) box.innerHTML = `<p class="small muro-load">Cargando fotos…</p>`;
  try {
    const r = await fetch(API, { cache: "no-store" }); if (!r.ok) throw new Error(r.status);
    const d = await r.json(); muroData = Array.isArray(d.fotos) ? d.fotos : [];
    if (d.now) muroSkew = Number(d.now) - Date.now();
    pintarMuro();
  } catch (e) {
    if (!silencioso || muroData === null) box.innerHTML = BASE
      ? `<div class="muro-vacio"><b>El muro vive en la app completa</b><span>Desde este link no se pueden ver ni subir fotos. Ábrelo aquí y sigue jugando.</span><a class="btn btn-gold" style="margin-top:10px" href="${BASE}/#antro" target="_blank" rel="noopener">Abrir el muro</a></div>`
      : `<div class="muro-vacio"><b>No se pudo cargar el muro</b><span>Revisa tu señal. Volvemos a intentar en un momento.</span></div>`;
  }
}
async function borrarFoto(id) {
  const mine = tokens()[id];
  const ok = await avisar(mine ? "¿Borrar tu foto del muro? Se borra para siempre." : "¿Quitar esta foto del muro? Se borra para siempre.", "Sí, borrarla", "Cancelar");
  if (!ok) return;
  const h = {}; if (mine) h["x-token"] = mine; else if (staffPin) h["x-staff-pin"] = staffPin;
  try {
    const r = await fetch(API + "?id=" + encodeURIComponent(id), { method: "DELETE", headers: h });
    if (r.status === 403) { toast("No se pudo: esta foto no es tuya."); return; }
    if (!r.ok) throw new Error(r.status);
    const t = tokens(); delete t[id]; setTokens(t);
    muroData = (muroData || []).filter(f => f.id !== id); pintarMuro(); toast("Foto borrada.");
    log("foto_borrada", mine ? "propia" : "staff");
  } catch (e) { toast("No se pudo borrar. Intenta otra vez."); }
}
async function modoStaff() {
  if (staffPin) { staffPin = ""; try { sessionStorage.removeItem("pb_staff"); } catch (e) {} toast("Saliste del modo staff."); VIEWS.muro(); return; }
  const pin = await avisar("Modo staff: escribe el PIN para poder quitar fotos del muro.", "Entrar", "Cancelar",
    `<input type="password" inputmode="text" autocomplete="off" maxlength="40" placeholder="PIN del staff" aria-label="PIN del staff">`);
  if (!pin) return;
  try {
    const r = await fetch(API + "?staff=1", { headers: { "x-staff-pin": pin }, cache: "no-store" });
    const d = await r.json();
    if (!d.staff) { toast("PIN incorrecto."); return; }
    staffPin = pin; try { sessionStorage.setItem("pb_staff", pin); } catch (e) {}
    toast("Modo staff activado."); VIEWS.muro();
  } catch (e) { toast("No se pudo revisar el PIN."); }
}
async function subirAlMuro(tipo, titulo, sub) {
  const ok = await avisar("<b>Asegúrate de que todos en la foto estén de acuerdo</b> antes de subirla. El muro lo ve toda la gente del lugar.", "Todos están de acuerdo", "Mejor no");
  if (!ok) return null;
  return await new Promise(res => {
    camara({ titulo: titulo || "Foto para el muro", sub: sub || "Se borra sola en 24 h", facing: "environment", usarTxt: "Subir al muro",
      onFoto: async src => { res(await publicarUI(src, tipo)); }, onCancel: () => res(null) });
  });
}

VIEWS.muro = () => {
  nav("muro"); clearInterval(muroTimer); clearInterval(muroTick);
  app.innerHTML = `${cabecera()}
    <h1 class="h-lg">El muro</h1>
    <p style="margin-top:10px;font-size:15px;color:var(--muted);line-height:1.5">Las fotos de la noche, con su marco. Cada una se borra sola 24 horas después de subirse.</p>
    <p class="legal-antro" style="margin-top:6px">Registramos datos anónimos de uso (sin nombres ni teléfonos). <button type="button" class="link-btn" data-privacidad style="font-size:inherit;padding:0">Aviso de privacidad</button> · <button type="button" class="link-btn" data-terminos style="font-size:inherit;padding:0">Reglas del muro</button></p>
    <button class="btn btn-gold" id="subir" style="margin-top:18px">Subir foto</button>
    <div class="muro" id="muro"></div>
    <button class="staff-link" id="staff" type="button">${staffPin ? "Salir del modo staff" : "Staff: moderar el muro"}</button>
    ${pie()}`;
  $("#subir").onclick = async () => { const r = await subirAlMuro("muro"); if (r && r.ok) cargarMuro(true); };
  $("#staff").onclick = modoStaff;
  $("#muro").onclick = e => { const b = e.target.closest("[data-del]"); if (b) borrarFoto(b.dataset.del); };
  if (muroData !== null) pintarMuro();
  cargarMuro();
  muroTimer = setInterval(() => { if (!$("#muro")) { clearInterval(muroTimer); return; } if (document.visibilityState === "visible") cargarMuro(true); }, 45000);
  muroTick = setInterval(() => { if (!$("#muro")) { clearInterval(muroTick); return; } pintarMuro(); }, 60000);
};
VIEWS.foto = VIEWS.muro;

/* «‹ Menú» en las pantallas del Modo Antro que no están en las pestañas de abajo */
["mesas", "trivia", "barra", "botella"].forEach(v => {
  const original = VIEWS[v]; if (typeof original !== "function") return;
  VIEWS[v] = function () {
    original.apply(this, arguments);
    app.insertAdjacentHTML("afterbegin", `<button type="button" class="atras-antro">‹ Menú</button>`);
    app.querySelector(".atras-antro").onclick = () => go("inicio");
  };
});

/* =====================================================================
   ENTRADA: +18 y selfie (luego directo a la ruleta)
   ===================================================================== */
let selfie = null;
VIEWS.edad = () => {
  // Si ya confirmó su edad al abrir la app, no se le vuelve a preguntar
  try { if (localStorage.getItem("pb.edad") === "1") { S.edad = true; save(); go("selfie"); return; } } catch (e) {}
  $("#tm-tabs").hidden = true;
  app.innerHTML = `
  <div style="min-height:calc(100dvh - 140px);display:flex;flex-direction:column">
    <img src="${ASSET.logo}" alt="Palma Blanca" style="height:64px;width:auto;align-self:flex-start">
    <div style="margin-top:auto;padding-top:40px">
      <div class="cond gold" style="font-weight:700;font-size:18px">Modo Antro</div>
      <h1 class="h-xl" style="margin-top:10px">Esta noche<br>se juega con<br><span class="gold">Palma Blanca</span></h1>
      <p style="margin-top:16px;font-size:16px;line-height:1.5;color:var(--muted)">Ruleta, retos entre mesas y el muro de fotos de la noche.</p>
      <p class="legal-antro">Solo mayores de 18 años. Disfruta con responsabilidad.</p>
      <div class="stack" style="margin-top:22px">
        <button class="btn btn-gold" id="si">Tengo 18 o más</button>
        <button class="btn btn-line" id="no">Soy menor</button>
      </div>
    </div>
  </div>`;
  $("#si").onclick = () => { S.edad = true; save(); actx(); go("selfie"); };
  $("#no").onclick = () => { app.innerHTML = `<div style="padding-top:30vh"><h1 class="h-lg">Te esperamos cuando cumplas 18.</h1></div>`; };
};
VIEWS.selfie = () => {
  $("#tm-tabs").hidden = true;
  app.innerHTML = `<img src="${ASSET.logo}" alt="Palma Blanca" style="height:44px;width:auto"><p class="legal-antro" style="margin-top:20px">Solo mayores de 18 años. Disfruta con responsabilidad.</p>`;
  camara({ titulo: "Tómate una selfie", sub: "Entrada al Modo Antro", nota: "Va al muro de la noche y se borra sola en 24 horas.", facing: "user", cancelTxt: "Entrar sin foto",
    usarTxt: "Usar esta selfie",
    onFoto: src => { entrar(); toast("Subiendo tu selfie al muro…"); publicar(src, "selfie").then(r => toast(r.ok ? "Tu selfie ya está en el muro." : "No se pudo subir tu selfie. Puedes intentarlo desde el muro.")); },
    onCancel: () => entrar(),
    atrasTxt: "‹ Atrás", onAtras: () => go("edad") });
};
/* Después de la selfie (o sin ella) se entra directo a la ruleta: sin nickname ni número de mesa */
function entrar() {
  S.registrado = true; save();
  log("registro", "", { selfie: true }); flush();
  go("ruleta");
};
VIEWS.registro = () => {
  $("#tm-tabs").hidden = true;
  app.innerHTML = `
  <img src="${ASSET.logo}" alt="Palma Blanca" style="height:44px;width:auto">
  <div class="cond gold" style="font-weight:700;font-size:16px;margin-top:22px">Paso 2 de 2</div>
  <h1 class="h-lg" style="margin-top:6px">¿Cómo te<br>decimos?</h1>
  ${selfie ? `<div class="selfie-fila"><div class="selfie-mini" id="mini"></div><div><p class="small">Tu selfie sale en el muro con tu nickname y se borra sola en 24 horas. Puedes borrarla antes desde el muro.</p><button type="button" class="link-btn" id="repetir">Tomar otra</button></div></div>`
           : `<div class="selfie-fila"><div><p class="small">Entras sin foto. Puedes subir una cuando quieras desde el muro.</p><button type="button" class="link-btn" id="repetir">Mejor sí me tomo una selfie</button></div></div>`}
  <form id="f" autocomplete="on">
    <label for="nombre">Tu nickname (máximo 15)</label>
    <input id="nombre" type="text" required maxlength="15" placeholder="Así te van a ver en el muro" value="${esc((S.nombre || "").slice(0, 15))}" autocomplete="nickname">
    <label for="mesa">Número de mesa</label>
    <input id="mesa" type="number" inputmode="numeric" min="1" max="${CONFIG.mesas}" placeholder="Viene en el sticker de tu mesa" value="${esc(S.mesa)}">
    <label for="wa">WhatsApp (opcional)</label>
    <input id="wa" type="tel" inputmode="tel" maxlength="15" placeholder="33 0000 0000" value="${esc(S.whatsapp)}">
    <div class="check"><input id="permiso" type="checkbox" ${S.permiso ? "checked" : ""}><label for="permiso" style="margin:0;color:var(--cream);font-size:14px">Avísenme de la próxima fiesta de Palma Blanca por WhatsApp.</label></div>
    <div class="check"><input id="sobrio" type="checkbox" ${S.sobrio ? "checked" : ""}><label for="sobrio" style="margin:0;color:var(--cream);font-size:14px">Hoy no tomo. Dame retos sin alcohol.</label></div>
    <button class="btn btn-gold" style="margin-top:24px" type="submit">Entrar</button>
    <p class="legal-antro">Solo mayores de 18 años. Disfruta con responsabilidad.</p>
    <p class="small" style="margin-top:8px">Tus datos solo los usa Palma Blanca. Aviso de privacidad en tequilapalmablanca.com.</p>
  </form>`;
  if (selfie) { const m = document.createElement("canvas"); const k = 176; m.width = k; m.height = k; const x = m.getContext("2d");
    const sw = selfie.width, sh = selfie.height, s = Math.max(k / sw, k / sh); x.drawImage(selfie, (k - sw * s) / 2, (k - sh * s) / 2, sw * s, sh * s); $("#mini").appendChild(m); }
  $("#repetir").onclick = () => go("selfie");
  $("#f").onsubmit = e => {
    e.preventDefault();
    const n = $("#nombre").value.replace(/\s+/g, " ").trim().slice(0, 15); if (!n) { $("#nombre").focus(); return; }
    S.nombre = n; S.mesa = $("#mesa").value.trim(); S.permiso = $("#permiso").checked; S.sobrio = $("#sobrio").checked;
    S.whatsapp = S.permiso ? $("#wa").value.replace(/[^\d+]/g, "") : "";
    S.registrado = true; save();
    log("registro", "", { whatsapp: S.whatsapp, permiso: S.permiso, selfie: !!selfie }); flush();
    const src = selfie; selfie = null;
    go("ruleta");
    if (src) { toast("Subiendo tu selfie al muro…"); publicar(src, "selfie").then(r => toast(r.ok ? "Tu selfie ya está en el muro." : "No se pudo subir tu selfie. Puedes intentarlo desde el muro.")); }
  };
};

/* =====================================================================
   RULETA
   ===================================================================== */
const COL = { oro: { bg: "#c9a46a", fg: "#0f1d3a" }, azul: { bg: "#2f5bd3", fg: "#f6f2e8" }, papel: { bg: "#efe8d8", fg: "#0f1d3a" }, naranja: { bg: "#D9582F", fg: "#f6f2e8" }, noche: { bg: "#0b1630", fg: "#c9a46a" } };
function variante(c) {
  if (!S.sobrio) return Object.assign({}, c);
  if (c.sinAlcohol) return Object.assign({}, c, c.sinAlcohol, { alcohol: false });
  return Object.assign({}, c, c.alcohol ? { _bloq: true } : {});
}
function rebanadas() {
  const cs = (AD.casillas || []).filter(c => c && c.id).map(c => Object.assign(variante(c), COL[c.color] || COL.papel));
  const R = AD.ronda && AD.ronda.id ? Object.assign(variante(AD.ronda), { especial: true }) : null;
  const g = R ? Math.min(20, Math.max(1, Number(AD.ronda.grados) || 4)) : 0;
  const n = cs.length || 1, each = (360 - g) / n, pos = Math.floor(n / 2) - 1;
  const sl = []; let a = 0;
  cs.forEach((c, i) => { sl.push({ c, a0: a, a1: a + each }); a += each; if (R && i === pos) { sl.push({ c: R, a0: a, a1: a + g }); a += g; } });
  return sl;
}
function enfriando() {
  const min = Number(AD.minutosEntreShots ?? CONFIG.minutosEntreShots ?? 15);
  return !S.sobrio && S.ultimoShot && (Date.now() - S.ultimoShot) < min * 60000;
}
function elegir(sl) {
  const frio = enfriando();
  const vale = s => !s.c._bloq && !(frio && s.c.alcohol);
  const esp = sl.find(s => s.c.especial);
  const p = Math.max(0, Math.min(1, Number(AD.ronda && AD.ronda.probabilidad) || 0));
  if (esp && !esp.c._bloq && Math.random() < p) {
    // Recién tomó un shot: la casilla dorada se respeta (1 de cada 100) pero en su versión sin alcohol.
    if (!(frio && esp.c.alcohol)) return esp;
    if (AD.ronda.sinAlcohol) return { ...esp, c: Object.assign({}, esp.c, AD.ronda.sinAlcohol, { alcohol: false }) };
  }
  let pool = sl.filter(s => !s.c.especial && vale(s));
  if (!pool.length) pool = sl.filter(s => !s.c.especial);
  const peso = s => s.c.peso == null ? 1 : Math.max(0, Number(s.c.peso) || 0);
  const tot = pool.reduce((t, s) => t + peso(s), 0);
  if (tot <= 0) return pool[Math.floor(Math.random() * pool.length)];
  let r = Math.random() * tot;
  for (const s of pool) { r -= peso(s); if (r < 0) return s; }
  return pool[pool.length - 1];
}
const P = (r, a) => [160 + r * Math.sin(a * Math.PI / 180), 160 - r * Math.cos(a * Math.PI / 180)];
function ruedaSVG(sl) {
  const r = 152; let p = "";
  sl.forEach(s => {
    const [x0, y0] = P(r, s.a0), [x1, y1] = P(r, s.a1), mid = (s.a0 + s.a1) / 2;
    if (s.c.especial) {
      p += `<path d="M160 160 L${x0.toFixed(2)} ${y0.toFixed(2)} A${r} ${r} 0 0 1 ${x1.toFixed(2)} ${y1.toFixed(2)} Z" fill="url(#oroG)" stroke="#0f1d3a" stroke-width="1.6" class="rl-oro"/>`;
      const [sx, sy] = P(r - 10, mid); p += `<circle cx="${sx.toFixed(1)}" cy="${sy.toFixed(1)}" r="2.6" fill="#fff8dc"/>`;
      return;
    }
    p += `<path d="M160 160 L${x0.toFixed(2)} ${y0.toFixed(2)} A${r} ${r} 0 0 1 ${x1.toFixed(2)} ${y1.toFixed(2)} Z" fill="${s.c.bg}" stroke="#0f1d3a" stroke-width="2"/>`;
    const lbl = String(s.c.corto || s.c.titulo || "").toUpperCase(), fs = lbl.length > 13 ? 11.5 : lbl.length > 10 ? 13 : 15;
    p += `<text x="${160 + 90}" y="${160 + fs * 0.36}" text-anchor="middle" transform="rotate(${(mid - 90).toFixed(2)} 160 160)" fill="${s.c.fg}" style="font:800 ${fs}px 'Barlow Condensed',sans-serif;letter-spacing:.02em">${esc(lbl)}</text>`;
  });
  return `<svg viewBox="0 0 320 320" role="img" aria-label="Ruleta de retos" id="rsvg2">
    <defs><linearGradient id="oroG" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff6d0"/><stop offset=".4" stop-color="#f2c654"/><stop offset="1" stop-color="#a8761f"/></linearGradient></defs>
    <g id="rueda2" style="transform:rotate(${rot}deg)">${p}<circle cx="160" cy="160" r="${r}" fill="none" stroke="#f6f2e8" stroke-width="5"/></g>
    <circle cx="160" cy="160" r="32" fill="#0f1d3a" stroke="#c9a46a" stroke-width="3"/>
    <image href="${ASSET.palm}" x="138" y="136" width="44" height="46" preserveAspectRatio="xMidYMid meet"/></svg>`;
}
let rot = 0, girando = false, rafId = 0, SL = null;
VIEWS.ruleta = () => {
  nav("ruleta"); cancelAnimationFrame(rafId); girando = false;
  SL = rebanadas();
  const frio = enfriando();
  app.innerHTML = `${cabecera()}
    <h1 class="h-lg">La ruleta</h1>
    <p style="margin-top:8px;font-size:14.5px;color:var(--muted);line-height:1.5">Gira y haz lo que salga. La casilla dorada es un regalo: sale 1 de cada 100 giros.</p>
    ${regalosPendientes()}
    <div class="rl-wrap">
      <svg class="rl-flecha" id="flecha" viewBox="0 0 36 44" aria-hidden="true"><path d="M3 3 H33 L18 41 Z" fill="#f6f2e8" stroke="#0f1d3a" stroke-width="3" stroke-linejoin="round"/></svg>
      ${ruedaSVG(SL)}
    </div>
    <button class="btn btn-gold" id="girar">Girar</button>
    <p class="small" style="text-align:center;margin-top:12px">${S.sobrio ? "Modo sin alcohol: los shots se cambian por agua o brindis." : frio ? "Ya te tocó un shot hace poco: por ahora la ruleta solo cae en casillas sin alcohol." : "En cualquier reto puedes decir «Paso». Nadie está obligado a tomar."}</p>
    <p class="legal-antro" style="text-align:center">Solo mayores de 18 años. Disfruta con responsabilidad.</p>`;
  $("#girar").onclick = girar; $("#rsvg2").onclick = girar;
  app.querySelectorAll("[data-rg]").forEach(b => b.onclick = () => { const r = (S.regalos || []).find(x => x.id === b.dataset.rg); if (r) verRegalo(r, false); });
};
function girar() {
  if (girando) return; girando = true; actx();
  const sl = SL || rebanadas(), s = elegir(sl);
  const span = s.a1 - s.a0, theta = s.a0 + span / 2 + (Math.random() - 0.5) * span * (s.c.especial ? 0.4 : 0.7);
  const from = rot, to = from + 360 * (reduce() ? 1 : 6) + (((-theta - from) % 360) + 360) % 360;
  const dur = reduce() ? 700 : 5600, t0 = performance.now();
  const g = $("#rueda2"), fl = $("#flecha"), b = $("#girar");
  if (b) { b.disabled = true; b.textContent = "Girando…"; }
  vib(25);
  let last = -1, lastTick = 0;
  const step = now => {
    const t = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - t, 4);
    rot = from + (to - from) * e;
    if (g) g.style.transform = `rotate(${rot}deg)`;
    const th = ((-rot % 360) + 360) % 360, idx = sl.findIndex(x => th >= x.a0 && th < x.a1);
    if (idx !== last) { last = idx; if (now - lastTick > 38) { lastTick = now; tone(1800, 0.02, "square", 0.035); if (fl && !reduce()) { fl.classList.remove("tic"); void fl.getBoundingClientRect(); fl.classList.add("tic"); } if (t > 0.8) vib(4); } }
    if (t < 1 && $("#rueda2") === g) { rafId = requestAnimationFrame(step); return; }
    girando = false; rot = to % 360;
    if ($("#rueda2") !== g) return;            // salió de la pantalla a media vuelta
    if (b) { b.disabled = false; b.textContent = "Girar"; }
    vib(s.c.especial ? [500, 120, 500, 120, 900] : [70, 40, 160]);
    tone(660, .14, "triangle", .12); tone(990, .22, "triangle", .1, .09);
    resultado(s.c);
  };
  rafId = requestAnimationFrame(step);
}
function celebrar() {
  const fx = document.createElement("div"); fx.className = "oro-flash"; tm.appendChild(fx); setTimeout(() => fx.remove(), 1400);
  [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, .35, "triangle", .12, i * .09));
  if (reduce()) return;
  const cols = ["#fff3c4", "#c9a46a", "#e4c27a", "#f6f2e8", "#2f5bd3", "#8f6d3a"];
  for (let i = 0; i < 90; i++) {
    const e = document.createElement("i"); e.className = "conf2";
    e.style.cssText = `left:${Math.random() * 100}vw;background:${cols[i % cols.length]};--dx:${(Math.random() - .5) * 160}px;--r:${Math.random() * 900 - 450}deg;animation-duration:${1.8 + Math.random() * 1.6}s;animation-delay:${Math.random() * .5}s`;
    tm.appendChild(e); setTimeout(() => e.remove(), 4200);
  }
}
/* =====================================================================
   REGALO de la casilla dorada: ticket con fecha, hora y folio para el mesero
   ===================================================================== */
const MESL = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const fechaTicket = d => `${d.getDate()} ${MESL[d.getMonth()]} ${d.getFullYear()}`;
const horaTicket = (d, seg) => d.toLocaleTimeString("es-MX", { hour: "numeric", minute: "2-digit", second: seg ? "2-digit" : undefined, hour12: true });
function regalosPendientes() {
  const p = (S.regalos || []).filter(r => r.verificado && !r.reclamado && Date.now() - r.ts < DAY);
  return p.map(r => `<button type="button" class="regalo-pend" data-rg="${esc(r.id)}">🎁 <span><b>${esc(r.titulo)}</b>Por reclamar · ${esc(fechaTicket(new Date(r.ts)))}, ${esc(horaTicket(new Date(r.ts)))} · Ver ticket</span></button>`).join("");
}
/* El servidor crea el folio con su propia fecha y hora, y lleva el registro de lo reclamado.
   Un regalo por cel cada 12 horas. */
async function nuevoRegalo(c) {
  const base = { titulo: c.titulo, texto: c.texto, conAlcohol: !!c.alcohol, reclamado: false };
  try {
    const r = await fetch(BASE + "/api/regalo", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ dispositivo: S.device, tipo: c.alcohol ? "shot" : "sinalcohol" }) });
    const d = await r.json();
    if (d.limitado) return Object.assign(base, { id: d.folio || "", ts: d.ts || Date.now(), limitado: true, verificado: !!d.folio });
    if (!r.ok || !d.folio) throw 0;
    const reg = Object.assign(base, { id: d.folio, ts: d.ts, verificado: true });
    S.regalos = (S.regalos || []).filter(x => Date.now() - x.ts < 7 * DAY).concat(reg); save();
    log("regalo", reg.id + (reg.conAlcohol ? " shot" : " sin alcohol"));
    return reg;
  } catch (e) {
    return Object.assign(base, { id: "", ts: Date.now(), verificado: false });
  }
}
async function estadoRegalo(folio) { try { const r = await fetch(BASE + "/api/regalo?folio=" + encodeURIComponent(folio), { cache: "no-store" }); return await r.json(); } catch (e) { return null; } }
function verRegalo(r, nuevo) {
  const d = new Date(r.ts);
  const ov = document.createElement("div"); ov.className = "ov ov-oro"; ov.setAttribute("role", "dialog"); ov.setAttribute("aria-modal", "true");
  const sinRegistro = !r.verificado;
  ov.innerHTML = `<div class="eti">${nuevo ? "Casilla dorada · ¡Regalo!" : "Tu regalo"}</div>
    <div class="big">${esc(r.limitado ? "Ya tienes tu regalo de esta noche" : r.titulo)}</div>
    <div class="ins">${esc(r.limitado ? "Es un regalo por persona cada noche. Si aún no lo reclamas, enséñale este ticket a tu mesero." : sinRegistro ? "No pudimos registrar tu regalo. Para reclamarlo, abre la app completa en palma-blanca-nfc.netlify.app y vuelve a intentarlo." : r.texto)}</div>
    ${r.id ? `<div class="regalo-ticket">
      <div class="rt-fila"><div><small>Fecha</small><b>${esc(fechaTicket(d))}</b></div><div><small>Hora</small><b>${esc(horaTicket(d, true))}</b></div></div>
      <div class="rt-folio"><small>Folio</small><b>${esc(r.id)}</b></div>
      <div class="rt-estado" id="rgEstado">${r.reclamado ? "Ya reclamado" : "Revisando…"}</div>
      <div class="rt-ahora">Hora actual en este cel: <span id="rgAhora">${esc(horaTicket(new Date(), true))}</span></div>
    </div>` : ""}
    <div class="acc2">
      ${r.id && !r.reclamado ? `<button class="btn" data-g="ok" style="background:#0f1d3a;color:#f3dc9e">Ya me lo dieron</button>` : ""}
      <div class="row2"><button class="btn" data-g="x" style="background:transparent;color:#0f1d3a;border:2px solid #0f1d3a">Cerrar</button><button class="btn" data-g="otra" style="background:transparent;color:#0f1d3a;border:2px solid #0f1d3a">Girar otra vez</button></div>
    </div>`;
  tm.appendChild(ov); lock(true);
  const reloj = setInterval(() => { const el = ov.querySelector("#rgAhora"); if (!el) { clearInterval(reloj); return; } el.textContent = horaTicket(new Date(), true); }, 1000);
  if (r.id) estadoRegalo(r.id).then(e => {
    const el = ov.querySelector("#rgEstado"); if (!el) return;
    if (!e) { el.textContent = "⚠️ Sin conexión: no se pudo verificar"; return; }
    if (!e.valido) { el.textContent = "✗ Folio no válido"; return; }
    if (e.reclamado) { el.textContent = "Ya reclamado · " + horaTicket(new Date(e.reclamadoTs)); r.reclamado = true; save(); const b = ov.querySelector("[data-g=ok]"); if (b) b.remove(); return; }
    el.textContent = "✓ Verificado · sin reclamar";
  });
  const cerrar = () => { clearInterval(reloj); ov.remove(); lock(false); if ($("#rueda2")) VIEWS.ruleta(); };
  ov.addEventListener("click", async e => {
    const b = e.target.closest("[data-g]"); if (!b) return; const g = b.dataset.g;
    if (g === "ok") {
      const si = await avisar("¿El mesero ya te dio tu regalo? Al confirmar, el folio queda como reclamado.", "Sí, ya me lo dio", "Todavía no");
      if (!si) return;
      try { await fetch(BASE + "/api/regalo?folio=" + encodeURIComponent(r.id) + "&accion=reclamar", { method: "POST" }); } catch (err) {}
      const guard = (S.regalos || []).find(x => x.id === r.id); if (guard) { guard.reclamado = true; guard.reclamadoTs = Date.now(); }
      r.reclamado = true; save(); log("regalo_reclamado", r.id);
      cerrar(); toast(r.conAlcohol ? "¡Salud! Disfrútalo con responsabilidad." : "¡Salud! Disfrútalo.");
      return;
    }
    cerrar();
    if (g === "otra") setTimeout(girar, 220);
  });
}

/* Cada casilla de la ruleta suma puntos solo la primera vez. Las gomitas se ganan con retos
   (cartas, mesa vs mesa y botella), no con giros. */
function cobrarRuleta(id, pts, motivo) {
  S.ruletaHechos = S.ruletaHechos || [];
  if (S.ruletaHechos.includes(id)) { toast("Esa casilla ya te había salido: no suma puntos."); return; }
  S.ruletaHechos.push(id); sumar(pts, motivo);
}
function resultado(c) {
  const esp = !!c.especial, esFoto = c.tipo === "foto", pts = Number(c.puntos) || 10;
  if (c.alcohol) { S.ultimoShot = Date.now(); save(); }
  log("ruleta", c.id);
  if (esp) {
    celebrar();
    nuevoRegalo(c).then(r => { if (r.verificado && !r.limitado) sumar(pts, "Regalo de la ruleta"); verRegalo(r, true); });
    return;
  }
  const txt = emph(esc(c.texto || "")).replace("{R}", "<b>" + rival() + "</b>");
  const fg = esp ? "#0f1d3a" : c.fg, bg = esp ? "" : c.bg;
  const ov = document.createElement("div"); ov.className = "ov" + (esp ? " ov-oro" : ""); ov.setAttribute("role", "dialog"); ov.setAttribute("aria-modal", "true");
  if (!esp) { ov.style.background = bg; ov.style.color = fg; }
  const prim = esFoto ? "Tomar foto" : (esp ? "¡Salud! +" + pts : (c.id === "salvado" || c.id === "reversazo" ? "Cobrar +" + pts : "¡Hecho! +" + pts));
  ov.innerHTML = `<div class="eti">${esp ? "Casilla dorada · 1 de cada 100" : "La ruleta"}</div>
    <div class="big">${esc(c.titulo || "")}</div>
    <div class="ins">${txt}</div>
    ${c.segundos ? `<div class="cuenta" id="cta">${Number(c.segundos)}</div>` : ""}
    <div class="acc2" id="acc" ${c.segundos ? "hidden" : ""}>
      <div class="row2">
        <button class="btn" data-r="paso" style="background:transparent;color:${fg};border:2px solid ${fg}">Paso</button>
        <button class="btn" data-r="ok" style="background:${fg};color:${esp ? "#f3dc9e" : bg}">${esc(prim)}</button>
      </div>
      <button class="btn" data-r="otra" style="background:transparent;color:${fg};border:2px solid ${fg};opacity:.9">Girar otra vez</button>
    </div>`;
  tm.appendChild(ov); lock(true);
  let t = null;
  if (c.segundos) {
    let n = Number(c.segundos); const el = ov.querySelector("#cta");
    tone(700, .1, "sine", .12);
    t = setInterval(() => {
      n--;
      if (n > 0) { el.textContent = n; vib(40); tone(700, .1, "sine", .12); }
      else { clearInterval(t); el.textContent = c.fin || "¡YA!"; el.classList.add("fin"); vib(300); tone(1050, .3, "triangle", .14); ov.querySelector("#acc").hidden = false; }
    }, 1000);
  }
  const cerrar = () => { if (t) clearInterval(t); ov.remove(); lock(false); };
  ov.addEventListener("click", async e => {
    const b = e.target.closest("[data-r]"); if (!b) return; const r = b.dataset.r;
    if (r === "paso") { cerrar(); passToast(); log("paso", c.id); return; }
    if (r === "otra") { cerrar(); if (!$("#rueda2")) go("ruleta"); setTimeout(girar, 220); return; }
    if (r === "ok") {
      cerrar();
      if (esFoto) {
        const res = await subirAlMuro("ruleta", c.titulo, "La ruleta · se sube al muro");
        if (res && res.ok) cobrarRuleta(c.id, pts, "Foto en el muro");
        return;
      }
      cobrarRuleta(c.id, pts, "Ruleta");
    }
  });
}
};
