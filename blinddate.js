/* =====================================================================
   LA PEDA · BLIND DATE
   Registro por parejas, cartas por nivel con especiales (Carta de Amor,
   Cupido, Brindis Palma, carta final), foto del recuerdo y resultados.
   Los textos están en blinddate-data.js. Usa las funciones de La Peda:
   go(), setTheme() y lpToast().
   ===================================================================== */
(function () {
"use strict";
const D = window.BLINDDATE_DATA;
const lp = document.getElementById("lp-app");
if (!D || !lp || typeof go !== "function" || typeof setTheme !== "function") return;

const $ = s => lp.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const reduce = () => !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
const TEMA = { bg1: "#0b1630", bg2: "#13204a", accent: "#D8A7B1" };   // azul marino con acento rosa palo (modos de citas)
/* Aviso arriba, para no tapar los botones de la carta */
let avisoEl = null;
function toast(m) {
  if (!avisoEl) { avisoEl = document.createElement("div"); avisoEl.className = "bd-aviso"; avisoEl.setAttribute("role", "status"); lp.appendChild(avisoEl); }
  avisoEl.textContent = m; avisoEl.hidden = false; clearTimeout(avisoEl._t); avisoEl._t = setTimeout(() => { avisoEl.hidden = true; }, 2600);
}
function vib(p) { try { const ua = navigator.userActivation; if (navigator.vibrate && (!ua || ua.hasBeenActive)) navigator.vibrate(p); } catch (e) {} }
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const k = Math.floor(Math.random() * (i + 1)); [a[i], a[k]] = [a[k], a[i]]; } return a; };
const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const lista = x => (Array.isArray(x) ? x : []).filter(t => typeof t === "string" && t.trim());

/* ---------- Estado ---------- */
let parejas = [];          // {ella, el, ship, amiga, coinc, pasos, tragos, cartas, segunda, foto(Blob), marco(Blob)}
let turno = 0, nCarta = 0, mazo = [], bolsaAmor = [], bolsaCupido = [], bolsaBrindis = [];
let desdeAmor = 0, amorEn = 9, ultimaEspecial = false, desdeEspecial = 0, actual = null, finalIdx = 0, fotoIdx = 0, timer = null;
let shipEditado = false;
let express = false, guardadas = [];
// express = "Cupido en la Mesa" (todos juegan, con los jugadores de La Peda). Si no, "Cita a Ciegas" (parejas registradas).
const NOMBRE = () => express ? "Cupido en la Mesa" : "Cita a Ciegas";

const R = D.ritmo || {};
const [amorMin, amorMax] = Array.isArray(R.cartaDeAmorCada) ? R.cartaDeAmorCada : [8, 10];

function nombreAmiga(p) { return (p && p.amiga) ? p.amiga : ""; }
function conAmiga(t, p) {
  const n = nombreAmiga(p);
  return String(t).replace(/\{amiga\}/g, n ? `${n}, la amiga que los juntó` : "la amiga que los juntó");
}
function primera(s) { return String(s || "").trim().split(/\s+/)[0] || ""; }
function cap(s) { s = String(s || ""); return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase(); }
function proponerShip(a, b) {
  a = primera(a); b = primera(b); if (!a || !b) return "";
  const p1 = a.slice(0, Math.ceil(a.length / 2));
  const p2 = b.slice(Math.max(1, Math.floor(b.length / 2) - 1));
  return cap(p1 + p2.toLowerCase());
}

/* ---------- Pantallas (se agregan a La Peda) ---------- */
lp.insertAdjacentHTML("beforeend", `
<section id="bdreg" class="screen bd-scroll">
  <div class="kicker">Cita a Ciegas · Paso 1</div>
  <h2 class="h">¿Quiénes<br>vienen?</h2>
  <p class="sub">Registra cada pareja. Con una basta para empezar.</p>
  <div class="bd-form">
    <div class="bd-row"><input id="bdElla" type="text" maxlength="16" placeholder="Nombre de ella" autocomplete="off"><input id="bdEl" type="text" maxlength="16" placeholder="Nombre de él" autocomplete="off"></div>
    <label for="bdShip">Nombre de la pareja (opcional)</label>
    <input id="bdShip" type="text" maxlength="22" placeholder="Si lo dejan vacío, se lo inventamos" autocomplete="off">
    <label for="bdAmiga">Amiga que trajo al date (opcional)</label>
    <input id="bdAmiga" type="text" maxlength="16" placeholder="Su nombre sale en las cartas Cupido" autocomplete="off">
    <button class="btn" type="button" data-bd="agregar">+ Agregar pareja</button>
  </div>
  <div class="bd-chips" id="bdChips"></div>
  <div class="bd-acciones">
    <button class="btn" type="button" id="bdStart" data-bd="empezar">Empezar</button>
    <button class="btn ghost" type="button" data-bd="modos">← Modos</button>
  </div>
</section>
<section id="bdgame" class="screen">
  <div class="topbar"><span class="mtag" id="bdTag">Cita a Ciegas</span><button class="x" type="button" data-bd="terminar" aria-label="Terminar el juego">✕</button></div>
  <div class="card bd-card" id="bdCard"></div>
  <div class="bd-acts" id="bdActs"></div>
</section>
<section id="bdfoto" class="screen bd-scroll">
  <div class="kicker" id="bdFotoK">Foto del recuerdo</div>
  <h2 class="h" id="bdFotoShip"></h2>
  <p class="sub" id="bdFotoSub"></p>
  <div class="bd-foto" id="bdFotoPrev"></div>
  <div class="bd-msg" id="bdFotoMsg" hidden></div>
  <div class="bd-acciones" id="bdFotoActs"></div>
  <input type="file" id="bdCam" accept="image/*" capture="environment" hidden>
</section>
<section id="bdres" class="screen bd-scroll">
  <div class="kicker" id="bdResK">Fin del juego</div>
  <h2 class="h">Resultados</h2>
  <div id="bdResBody"></div>
  <div class="bd-acciones" style="margin-top:8px">
    <button class="btn" type="button" data-bd="compartir">Mandar al grupo</button>
    <button class="btn ghost" type="button" data-bd="otra">Jugar otra vez</button>
    <button class="btn ghost" type="button" data-bd="modos">Otros modos</button>
  </div>
</section>`);

/* Tarjeta del modo y acceso desde la portada de La Peda */
const grid = lp.querySelector("#modes .grid");
if (grid) grid.insertAdjacentHTML("beforeend", `<div class="mode m-bd2" data-bd="express" role="button" tabindex="0"><div class="mico">💞</div><div><div class="mpill">Todos juegan</div><div class="mname">Cupido en la Mesa</div><div class="mdesc">Para todo el grupo. Cada quien su carta, que hable el corazón.</div></div></div><div class="mode m-bd" data-bd="abrir" role="button" tabindex="0"><div class="mico">💘</div><div><div class="mpill">En pareja</div><div class="mname">Cita a Ciegas</div><div class="mdesc">Para dos. Conózcanse carta por carta.</div></div></div>`);
const introRow = lp.querySelector("#intro .btn-row");
if (introRow) introRow.insertAdjacentHTML("beforeend", `<button class="btn ghost bd-intro" type="button" data-bd="abrir">💘 Cita a Ciegas</button>`);

/* ---------- Registro ---------- */
function empezarExpress() {
  const ps = (typeof players !== "undefined" && Array.isArray(players)) ? players.slice() : [];
  if (ps.length < 1) { go("players"); return; }
  if (!express) guardadas = parejas;
  express = true;
  parejas = ps.map(n => ({ ship: n, ella: n, el: "su pareja", amiga: "", express: true }));
  empezar();
}
function abrir() { const de = pantalla(); if (de === "intro" || de === "modes") origenBD = de; if (express) { parejas = guardadas; express = false; } clearInterval(timer); setTheme(TEMA); go("bdreg"); pintarParejas(); }
function pintarParejas() {
  const box = $("#bdChips");
  box.innerHTML = parejas.length ? parejas.map((p, i) => `<div class="bd-chip"><div><b>${esc(p.ship)}</b><span>${esc(p.ella)} & ${esc(p.el)}</span>${p.amiga ? `<small>Los juntó: ${esc(p.amiga)}</small>` : ""}</div><button type="button" data-bd="quitar" data-i="${i}" aria-label="Quitar a ${esc(p.ship)}">×</button></div>`).join("")
    : `<p class="empty" style="margin:6px 0 4px">Aún no hay parejas 💘</p>`;
  const b = $("#bdStart"); const ok = parejas.length >= 1;
  b.style.opacity = ok ? "1" : ".4"; b.style.pointerEvents = ok ? "auto" : "none";
}
function sugerir() { if (!shipEditado) $("#bdShip").value = proponerShip($("#bdElla").value, $("#bdEl").value); }
$("#bdElla").addEventListener("input", sugerir);
$("#bdEl").addEventListener("input", sugerir);
$("#bdShip").addEventListener("input", () => { shipEditado = $("#bdShip").value.trim() !== ""; });
function agregar() {
  const ella = $("#bdElla").value.trim(), el = $("#bdEl").value.trim();
  if (!ella) { $("#bdElla").focus(); toast("Falta el nombre de ella."); return; }
  if (!el) { $("#bdEl").focus(); toast("Falta el nombre de él."); return; }
  if (parejas.length >= 12) { toast("Máximo 12 parejas."); return; }
  const ship = $("#bdShip").value.trim() || proponerShip(ella, el) || `${primera(ella)} & ${primera(el)}`;
  parejas.push({ ella, el, ship, amiga: $("#bdAmiga").value.trim() });
  ["#bdElla", "#bdEl", "#bdShip", "#bdAmiga"].forEach(s => { $(s).value = ""; });
  shipEditado = false; pintarParejas(); $("#bdElla").focus(); vib(15);
}
["#bdElla", "#bdEl", "#bdShip", "#bdAmiga"].forEach(s => $(s).addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); agregar(); } }));

/* ---------- Juego ---------- */
function empezar() {
  if (!parejas.length) return;
  parejas.forEach(p => Object.assign(p, { coinc: 0, pasos: 0, tragos: 0, cartas: 0, segunda: null, foto: null, marco: null }));
  mazo = []; (D.niveles || []).forEach((n, i) => { mazo = mazo.concat(shuffle(lista(n.cartas).map(t => ({ tipo: "normal", t, nivel: i })))); });
  bolsaAmor = shuffle(lista(D.cartasDeAmor)); bolsaCupido = express ? [] : shuffle(lista(D.cupido)); bolsaBrindis = shuffle(lista(D.brindis));
  turno = -1; nCarta = 0; desdeAmor = 0; amorEn = rnd(amorMin, amorMax); ultimaEspecial = false; desdeEspecial = 0; finalIdx = 0; fotoIdx = 0;
  setTheme(TEMA); go("bdgame"); siguiente(false);
}
/* Cupido y Brindis: nunca en las primeras 3 cartas y con al menos 3 cartas normales entre especiales */
function puedeEspecial() { return nCarta >= 3 && desdeEspecial >= 3; }
function pareja() { return parejas[((turno % parejas.length) + parejas.length) % parejas.length]; }
function siguiente(mismaPareja) {
  clearInterval(timer);
  if (!mismaPareja) turno++;
  let c = null;
  if (bolsaAmor.length === 0) bolsaAmor = shuffle(lista(D.cartasDeAmor));
  if (desdeAmor >= amorEn && bolsaAmor.length && mazo.length) { c = { tipo: "amor", t: bolsaAmor.pop() }; desdeAmor = 0; amorEn = rnd(amorMin, amorMax); }
  else if (puedeEspecial() && bolsaCupido.length && mazo.length && Math.random() < (Number(R.probabilidadCupido) || 0)) c = { tipo: "cupido", t: bolsaCupido.pop() };
  else if (puedeEspecial() && bolsaBrindis.length && mazo.length && Math.random() < (Number(R.probabilidadBrindis) || 0)) c = { tipo: "brindis", t: bolsaBrindis.pop() };
  else if (mazo.length) c = mazo.shift();
  if (!c) { aFinal(); return; }
  if (c.tipo !== "amor") desdeAmor++;
  ultimaEspecial = c.tipo !== "normal";
  desdeEspecial = ultimaEspecial ? 0 : desdeEspecial + 1;
  nCarta++; pareja().cartas++;
  actual = c; pintar();
}
const NIVEL = i => ((D.niveles || [])[i] || {}).nombre || "";
const toma = t => /\btom(a|as|an|en)\b/i.test(t);
function pintar(fase) {
  const c = actual, p = c.tipo === "final" ? parejas[finalIdx] : pareja();
  const etiqueta = { normal: NIVEL(c.nivel), amor: "Carta de Amor", cupido: "Cupido", brindis: "Brindis Palma", final: "Carta final" }[c.tipo];
  const kind = { amor: "💘 Carta de Amor", cupido: "🏹 Cupido", brindis: "🥂 Brindis Palma", final: "💌 Carta final" }[c.tipo] || "";
  let txt = c.t;
  if (c.tipo === "brindis") txt = `Brinden con Palma Blanca por ${conAmiga(c.t, p)}.`;
  else txt = conAmiga(txt, p);
  if (p.express) txt = txt.replace(/\btu date\b/gi, "tu pareja");
  const para = c.tipo === "cupido" ? `<div class="bd-para">Para ${esc(nombreAmiga(p) || "la amiga que los juntó")}</div>` : "";
  $("#bdTag").textContent = NOMBRE() + " · " + (c.tipo === "normal" ? etiqueta : "Especial");
  $("#bdCard").innerHTML = `<div class="num">${c.tipo === "final" ? "ÚLTIMA CARTA" : "CARTA " + nCarta} · ${esc(etiqueta).toUpperCase()}</div>
    ${kind ? `<div class="bd-kind">${kind}</div>` : ""}
    <div class="bd-pareja"><b>${esc(p.ship)}</b><span>${p.express ? "Esta carta es para ti y tu pareja" : esc(p.ella) + " & " + esc(p.el)}</span></div>
    ${para}<div class="txt bd-txt swap">${esc(txt)}</div><div class="bd-cuenta" id="bdCta" aria-live="assertive"></div>`;
  let a = "";
  if (c.tipo === "normal") a = `<button class="btn" data-bd="sig">Siguiente</button><div class="row"><button class="btn ghost" data-bd="paso">Paso · toman 1</button>${toma(c.t) ? `<button class="btn ghost" data-bd="tomaron">Tomaron 🥃</button>` : `<span></span>`}</div>`;
  else if (c.tipo === "cupido") a = `<button class="btn" data-bd="sig">Siguiente</button><div class="row"><button class="btn ghost" data-bd="paso">Paso · toman 1</button><span></span></div>`;
  else if (c.tipo === "brindis") a = `<button class="btn" data-bd="salud">¡Salud! 🥂</button><div class="row"><button class="btn ghost" data-bd="paso">Paso</button><span></span></div>`;
  else if (c.tipo === "amor" || c.tipo === "final") {
    if (fase === "resp") a = c.tipo === "amor"
      ? `<div class="row"><button class="btn" data-bd="coinc">Coincidimos 💘</button><button class="btn ghost" data-bd="nocoinc">No coincidimos</button></div>`
      : `<button class="btn" data-bd="seg-si">Los dos dijeron que sí 💘</button><div class="row"><button class="btn ghost" data-bd="seg-dif">Dijeron cosas distintas</button><button class="btn ghost" data-bd="seg-no">Los dos dijeron que no</button></div>`;
    else a = `<button class="btn" data-bd="contar">3, 2, 1… ¡Contesten!</button><div class="row"><button class="btn ghost" data-bd="paso">Paso · toman 1</button><span></span></div>`;
  }
  $("#bdActs").innerHTML = a;
}
function contar() {
  $("#bdActs").innerHTML = ""; const el = $("#bdCta"); let n = 3;
  const paso = () => {
    if (n > 0) { el.textContent = n; el.classList.remove("pulso"); void el.offsetWidth; el.classList.add("pulso"); vib(40); n--; }
    else { clearInterval(timer); el.textContent = "¡YA!"; vib([180, 60, 180]); pintar("resp"); $("#bdCta").textContent = "¡YA!"; }
  };
  paso(); timer = setInterval(paso, 850);
}
function pasar() {
  const p = actual.tipo === "final" ? parejas[finalIdx] : pareja();
  p.pasos++; p.tragos++;
  toast(`Paso: ${p.ship} toma un trago de Palma Blanca.`); vib(30);
  if (actual.tipo === "final") { p.segunda = "paso"; sigFinal(); return; }
  if (actual.tipo === "amor") bolsaAmor.unshift(actual.t);
  siguiente(true);
}

/* ---------- Carta final, una por pareja ---------- */
function aFinal() { clearInterval(timer); if (nCarta === 0) { go("modes"); return; } finalIdx = 0; actual = { tipo: "final", t: D.final || "¿Habrá segunda cita? Contesten al mismo tiempo: 3, 2, 1…" }; pintar(); }
function sigFinal() { finalIdx++; if (finalIdx < parejas.length) { pintar(); return; } fotoIdx = 0; pantallaFoto(); }

/* ---------- Foto del recuerdo ---------- */
const MES = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];
const fecha = d => `${d.getDate()} ${MES[d.getMonth()]} ${d.getFullYear()}`;
function cargar(src) { return new Promise((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = ko; i.src = src; }); }
function fitText(x, t, w, size, family, min) { let s = size; x.font = `${s}px ${family}`; while (x.measureText(t).width > w && s > min) { s -= 3; x.font = `${s}px ${family}`; } }
async function marco(p, img) {
  try { await Promise.all([document.fonts.load("96px Rye"), document.fonts.load("600 34px Outfit")]); } catch (e) {}
  const W = 1080, H = 1350, c = document.createElement("canvas"); c.width = W; c.height = H; const x = c.getContext("2d");
  const bg = x.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, "#13244b"); bg.addColorStop(1, "#0b1630"); x.fillStyle = bg; x.fillRect(0, 0, W, H);
  const M = 64, PW = W - 2 * M, PY = 64, PH = 900;
  x.save(); x.beginPath(); x.rect(M, PY, PW, PH); x.clip();
  if (img) {
    const sw = img.naturalWidth || img.width, sh = img.naturalHeight || img.height, s = Math.max(PW / sw, PH / sh);
    x.drawImage(img, M + (PW - sw * s) / 2, PY + (PH - sh * s) / 2, sw * s, sh * s);
  } else {
    const g = x.createLinearGradient(M, PY, M + PW, PY + PH); g.addColorStop(0, "#2f5bd3"); g.addColorStop(.55, "#13244b"); g.addColorStop(1, "#0b1630");
    x.fillStyle = g; x.fillRect(M, PY, PW, PH);
    // Corazón
    const cx = W / 2, cy = PY + PH / 2 - 20, k = 9;
    x.beginPath();
    for (let t = 0; t <= Math.PI * 2 + .01; t += .02) {
      const hx = 16 * Math.pow(Math.sin(t), 3), hy = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
      t === 0 ? x.moveTo(cx + hx * k, cy - hy * k) : x.lineTo(cx + hx * k, cy - hy * k);
    }
    x.closePath(); x.fillStyle = "rgba(255,255,255,.14)"; x.fill(); x.strokeStyle = "rgba(228,194,122,.85)"; x.lineWidth = 4; x.stroke();
    x.textAlign = "center"; x.fillStyle = "#fff"; fitText(x, p.ship, PW - 120, 110, "Rye,Georgia,serif", 50); x.fillText(p.ship, cx, cy + 34);
  }
  x.restore();
  x.strokeStyle = "#c9a46a"; x.lineWidth = 3; x.strokeRect(M - 16, PY - 16, PW + 32, PH + 32);
  x.strokeStyle = "rgba(201,164,106,.45)"; x.lineWidth = 1.5; x.strokeRect(M - 28, PY - 28, PW + 56, PH + 56);
  x.fillStyle = "#c9a46a";
  [[M - 16, PY - 16], [M + PW + 16, PY - 16], [M - 16, PY + PH + 16], [M + PW + 16, PY + PH + 16]].forEach(([a, b]) => { x.beginPath(); x.moveTo(a, b - 9); x.lineTo(a + 9, b); x.lineTo(a, b + 9); x.lineTo(a - 9, b); x.closePath(); x.fill(); });
  const by = PY + PH + 30;
  x.textAlign = "center"; x.fillStyle = "#efe8d8"; fitText(x, p.ship, W - 160, 96, "Rye,Georgia,serif", 44); x.fillText(p.ship, W / 2, by + 112);
  x.fillStyle = "rgba(239,232,216,.85)"; x.font = "500 34px Outfit,sans-serif"; x.fillText(`${p.ella} & ${p.el}`, W / 2, by + 168);
  try { x.letterSpacing = "4px"; } catch (e) {}
  x.fillStyle = "#c9a46a"; x.font = "600 24px Outfit,sans-serif"; x.fillText(`${NOMBRE().toUpperCase()} · PALMA BLANCA · ${fecha(new Date())}`, W / 2, by + 222);
  try { x.letterSpacing = "0px"; } catch (e) {}
  if (window.__pbLogo) { try { const lg = await cargar(window.__pbLogo); const lh = 54, lw = lg.width * lh / lg.height; x.globalAlpha = .9; x.drawImage(lg, (W - lw) / 2, by + 246, lw, lh); x.globalAlpha = 1; } catch (e) {} }
  return await new Promise(r => c.toBlob(r, "image/jpeg", .88));
}
let urlActual = null;
function pantallaFoto() {
  clearInterval(timer);
  const p = parejas[fotoIdx];
  setTheme(TEMA); go("bdfoto");
  $("#bdFotoK").textContent = `Foto del recuerdo · ${fotoIdx + 1} de ${parejas.length}`;
  $("#bdFotoShip").textContent = p.ship;
  $("#bdFotoSub").textContent = `${p.ella} y ${p.el}: tómense una foto juntos para el recuerdo.`;
  $("#bdFotoMsg").hidden = true; $("#bdFotoPrev").innerHTML = "";
  if (p.marco) mostrarMarco(p); else accionesFoto(false);
  lp.querySelector("#bdfoto").scrollTop = 0;
}
function accionesFoto(conFoto) {
  $("#bdFotoActs").innerHTML = conFoto
    ? `<button class="btn" data-bd="foto-ok">${fotoIdx + 1 < parejas.length ? "Siguiente pareja" : "Ver resultados"}</button><div class="row"><button class="btn ghost" data-bd="foto-tomar">Repetir</button><button class="btn ghost" data-bd="foto-bajar">Descargar</button></div>`
    : `<button class="btn" data-bd="foto-tomar">📸 Tomar foto</button><button class="btn ghost" data-bd="foto-saltar">Saltar</button><p class="bd-nota">¿La cámara no abre? Toca «Saltar» y seguimos sin foto.</p>`;
}
async function mostrarMarco(p) {
  if (urlActual) URL.revokeObjectURL(urlActual);
  urlActual = URL.createObjectURL(p.marco);
  $("#bdFotoPrev").innerHTML = `<img src="${urlActual}" alt="Foto del recuerdo de ${esc(p.ship)}">`;
  accionesFoto(true);
}
const cam = $("#bdCam");
cam.addEventListener("change", async () => {
  const f = cam.files && cam.files[0]; cam.value = ""; if (!f) return;
  const p = parejas[fotoIdx];
  $("#bdFotoMsg").hidden = false; $("#bdFotoMsg").textContent = "Poniéndole el marco…";
  try {
    const u = URL.createObjectURL(f); const img = await cargar(u);
    p.foto = true; p.marco = await marco(p, img); URL.revokeObjectURL(u);
    $("#bdFotoMsg").hidden = true; mostrarMarco(p); vib([40, 40, 120]);
  } catch (e) { fotoFallo("No pudimos leer esa foto. Intenten otra vez o toquen «Saltar»."); }
});
cam.addEventListener("cancel", () => fotoFallo("No se tomó la foto. No pasa nada: pueden intentarlo otra vez o saltar este paso."));
function fotoFallo(t) { const m = $("#bdFotoMsg"); m.hidden = false; m.textContent = t; accionesFoto(false); }
function tomarFoto() {
  try { cam.click(); }
  catch (e) { fotoFallo("No pudimos abrir la cámara aquí. No pasa nada: toquen «Saltar» y seguimos."); }
}
async function sigFoto(saltar) {
  const p = parejas[fotoIdx];
  if (saltar || !p.marco) { p.foto = false; p.marco = await marco(p, null); }
  fotoIdx++;
  if (fotoIdx < parejas.length) pantallaFoto(); else resultados();
}

/* ---------- Descargar (Netlify y link de claude.ai) ---------- */
async function descargar(blob, nombre) {
  try {
    if (window.claude && typeof window.claude.use === "function") {
      const d = await window.claude.use("downloads");
      if (d) { await d.save({ filename: nombre, data: blob }); return; }
    }
  } catch (e) { if (e && e.code === "declined") return; }
  try {
    const u = URL.createObjectURL(blob), a = document.createElement("a");
    a.href = u; a.download = nombre; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(u), 5000);
  } catch (e) { toast("No se pudo descargar en este navegador."); }
}
const archivo = p => (express ? "cupido-en-la-mesa-" : "cita-a-ciegas-") + (p.ship || "pareja").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + ".jpg";

/* ---------- Resultados ---------- */
const SEG = { si: "Sí habrá segunda cita 💘", dif: "Dijeron cosas distintas", no: "Esta vez no", paso: "Prefirieron no decir" };
let urlsRes = [];
function resultados() {
  clearInterval(timer); urlsRes.forEach(u => URL.revokeObjectURL(u)); urlsRes = [];
  const orden = parejas.map((p, i) => ({ p, i }));
  const perfecta = orden.slice().sort((a, b) => b.p.coinc - a.p.coinc || a.p.pasos - b.p.pasos || a.i - b.i)[0].p;
  const valiente = orden.slice().sort((a, b) => a.p.pasos - b.p.pasos || b.p.cartas - a.p.cartas || a.i - b.i)[0].p;
  const brindo = orden.slice().sort((a, b) => b.p.tragos - a.p.tragos || a.i - b.i)[0].p;
  const url = p => { const u = URL.createObjectURL(p.marco); urlsRes.push(u); return u; };
  const totalAmor = parejas.reduce((t, p) => t + p.coinc, 0);
  let h = `<div class="rs-big"><div><b>${nCarta}</b><span>cartas</span></div><div><b>${parejas.length}</b><span>${parejas.length === 1 ? "pareja" : "parejas"}</span></div><div><b>${totalAmor}</b><span>coincidencias</span></div></div>`;
  h += `<div class="bd-perfecta"><small>💘 La Pareja Perfecta</small>
      <div class="bd-foto" style="margin:12px auto"><img src="${url(perfecta)}" alt="Foto de ${esc(perfecta.ship)}"></div>
      <b>${esc(perfecta.ship)}</b><span>${esc(perfecta.ella)} & ${esc(perfecta.el)}</span>
      <p>${perfecta.coinc ? `Coincidieron ${perfecta.coinc} ${perfecta.coinc === 1 ? "vez" : "veces"} en las Cartas de Amor.` : "Hoy no coincidieron en las Cartas de Amor, pero el destino ya habló."}</p></div>`;
  if (parejas.length > 1) {
    h += `<div class="rs-award"><span class="em">🦁</span><div><small>La más valiente</small><b>${esc(valiente.ship)}</b><p>${valiente.pasos ? `Solo usó «Paso» ${valiente.pasos} ${valiente.pasos === 1 ? "vez" : "veces"}` : "Nunca usó «Paso»"}</p></div></div>`;
    h += `<div class="rs-award"><span class="em">🥂</span><div><small>La que más brindó</small><b>${esc(brindo.ship)}</b><p>${brindo.tragos} ${brindo.tragos === 1 ? "trago" : "tragos"} de Palma Blanca</p></div></div>`;
  }
  h += `<h3 class="bd-h3">¿Habrá segunda cita?</h3><div class="rs-table">${parejas.map(p => `<div><span>${esc(p.ship)}</span><span>${esc(SEG[p.segunda] || "Sin contestar")}</span></div>`).join("")}</div>`;
  h += `<h3 class="bd-h3">Así les fue</h3><div class="rs-table">${parejas.map(p => `<div><span>${esc(p.ship)}</span><span>${p.coinc} 💘 · ${p.pasos} pasos · ${p.tragos} tragos</span></div>`).join("")}</div>`;
  h += `<h3 class="bd-h3">Fotos del recuerdo</h3><div class="bd-galeria">${parejas.map((p, i) => `<figure><img src="${url(p)}" alt="Foto del recuerdo de ${esc(p.ship)}"><figcaption>${esc(p.ship)}</figcaption><button class="bd-bajar" type="button" data-bd="bajar" data-i="${i}">Descargar</button></figure>`).join("")}</div>`;
  h += `<p class="rs-note">Las fotos solo viven en este cel mientras la app esté abierta. Descárguenlas para guardarlas.</p>`;
  $("#bdResBody").innerHTML = h;
  $("#bdResK").textContent = "Fin de " + NOMBRE(); setTheme(TEMA); go("bdres"); lp.querySelector("#bdres").scrollTop = 0;
  vib([60, 40, 60, 40, 240]);
}
function textoResumen() {
  const perf = parejas.slice().sort((a, b) => b.coinc - a.coinc || a.pasos - b.pasos)[0];
  let t = `${express ? "💞" : "💘"} ${NOMBRE()} · Palma Blanca\n${nCarta} cartas · ${parejas.length} ${express ? (parejas.length === 1 ? "jugador" : "jugadores") : (parejas.length === 1 ? "pareja" : "parejas")}\n`;
  if (perf) t += `💘 La Pareja Perfecta: ${perf.ship} (${perf.ella} & ${perf.el})\n`;
  t += "\n" + parejas.map(p => `${p.ship}: ${p.coinc} coincidencias · ${p.pasos} pasos · ¿Segunda cita? ${SEG[p.segunda] || "Sin contestar"}`).join("\n");
  return t;
}
async function compartir() {
  const t = textoResumen();
  try { if (navigator.share) { await navigator.share({ text: t }); return; } } catch (e) { if (e && e.name === "AbortError") return; }
  try { await navigator.clipboard.writeText(t); toast("Copiado. Pégalo en tu grupo de WhatsApp."); } catch (e) { toast("No se pudo copiar en este navegador."); }
}

/* ---------- Clics ---------- */
lp.addEventListener("click", e => {
  const b = e.target.closest("[data-bd]"); if (!b) return;
  e.stopPropagation();
  const k = b.dataset.bd, p = actual && (actual.tipo === "final" ? parejas[finalIdx] : pareja());
  switch (k) {
    case "abrir": abrir(); break;
    case "atras": atras(); break;
    case "agregar": agregar(); break;
    case "quitar": parejas.splice(+b.dataset.i, 1); pintarParejas(); break;
    case "empezar": empezar(); break;
    case "modos": clearInterval(timer); go("modes"); break;
    case "terminar": aFinal(); break;
    case "sig": vib(10); siguiente(false); break;
    case "paso": pasar(); break;
    case "tomaron": p.tragos++; toast("¡Salud! Anotado."); siguiente(false); break;
    case "salud": p.tragos++; vib(40); siguiente(false); break;
    case "contar": contar(); break;
    case "coinc": p.coinc++; vib([60, 40, 200]); toast(`¡Coincidieron! Toda la mesa toma por ${p.ship} 💘`); siguiente(false); break;
    case "nocoinc": p.tragos++; toast("Brinden por la diferencia 🥂"); siguiente(false); break;
    case "seg-si": p.segunda = "si"; vib([60, 40, 200]); sigFinal(); break;
    case "seg-dif": p.segunda = "dif"; sigFinal(); break;
    case "seg-no": p.segunda = "no"; sigFinal(); break;
    case "foto-tomar": tomarFoto(); break;
    case "foto-saltar": sigFoto(true); break;
    case "foto-ok": sigFoto(false); break;
    case "foto-bajar": { const q = parejas[fotoIdx]; if (q && q.marco) descargar(q.marco, archivo(q)); break; }
    case "bajar": { const q = parejas[+b.dataset.i]; if (q && q.marco) descargar(q.marco, archivo(q)); break; }
    case "compartir": compartir(); break;
    case "otra": if (express) empezarExpress(); else abrir(); break;
    case "express": empezarExpress(); break;
  }
});
lp.addEventListener("keydown", e => { if ((e.key === "Enter" || e.key === " ") && e.target.matches(".m-bd, .m-bd2")) { e.preventDefault(); e.target.matches(".m-bd2") ? empezarExpress() : abrir(); } });

/* ---------- «‹ Atrás» en todas las pantallas de La Peda ---------- */
let origenBD = "intro";
function pantalla() { const s = lp.querySelector(".screen.active"); return s ? s.id : "intro"; }
const barra = lp.querySelector(".lp-bar");
if (barra) { barra.style.gap = "8px"; barra.insertAdjacentHTML("beforeend", `<button type="button" id="lpAtras" data-bd="atras" hidden>‹ Atrás</button>`); }
function pintarAtras() { const b = document.getElementById("lpAtras"); if (b) b.hidden = pantalla() === "intro"; }
if (typeof window.go === "function") {
  const irOriginal = window.go;
  window.go = function (id) { const r = irOriginal.apply(this, arguments); pintarAtras(); return r; };
}
function atras() {
  clearInterval(timer);
  const s = pantalla();
  if (s === "players") go("intro");
  else if (s === "modes") go("players");
  else if (s === "game" || s === "resumen" || s === "bdres") go("modes");
  else if (s === "bdreg") go(origenBD);
  else if (s === "bdgame") { if (express) go("modes"); else abrir(); }
  else if (s === "bdfoto") { if (fotoIdx > 0) { fotoIdx--; pantallaFoto(); } else if (express) go("modes"); else abrir(); }
  else go("intro");
  vib(10);
}
pintarAtras();
window.lpAtras = atras;   // la barra superior de la app usa este mismo «Atrás»

/* ---------- Abrir directo desde el NFC: ?modo=blinddate o #blinddate ---------- */
function desdeEnlace() {
  let m = ""; try { m = (new URLSearchParams(location.search).get("modo") || "").toLowerCase().replace(/[^a-z]/g, ""); } catch (e) {}
  const h = (location.hash || "").toLowerCase();
  if (m !== "blinddate" && h !== "#blinddate") return;
  if (location.hash !== "#peda") {
    try { history.replaceState(null, "", location.pathname + location.search + "#peda"); } catch (e) { location.hash = "peda"; }
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  }
  abrir();
}
window.addEventListener("hashchange", () => { if ((location.hash || "").toLowerCase() === "#blinddate") desdeEnlace(); });
desdeEnlace();
})();
