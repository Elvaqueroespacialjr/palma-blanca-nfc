/* =====================================================================
   PALMA BLANCA NFC · Funciones generales de la app
   - Aviso de +18 al abrir (una sola vez por cel).
   - Aviso de privacidad (textos en privacidad-data.js). Cualquier botón
     con el atributo data-privacidad lo abre.
   - Datos anónimos de uso de toda la app (sin nombres ni teléfonos).
   - Estadísticas para el staff: abre la app con #estadisticas.
   ===================================================================== */
(function () {
"use strict";
const LS = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };
const API = window.PB_API_BASE != null ? window.PB_API_BASE : "";
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const lock = on => document.body.classList.toggle("lock", !!on);

/* ---------- Datos anónimos de uso ---------- */
let dev = LS.get("pb.dev");
if (!dev) { dev = Math.random().toString(36).slice(2, 12); LS.set("pb.dev", dev); }
let cola = [];
/* La cola se guarda en el cel: si no hay señal, los datos esperan y se mandan cuando vuelva */
try { cola = JSON.parse(LS.get("pb.cola") || sessionStorage.getItem("pb.cola") || "[]"); if (!Array.isArray(cola)) cola = []; } catch (e) { cola = []; }
const guardarCola = () => LS.set("pb.cola", JSON.stringify(cola.slice(-300)));
window.pbLog = function (tipo, detalle) {
  cola.push({ tipo: String(tipo).slice(0, 40), detalle: String(detalle || "").slice(0, 80), device: dev, src: "app", ts: new Date().toISOString() });
  guardarCola(); if (cola.length >= 20) enviar();
};
let enviando = false;
async function enviar() {
  if (enviando || !cola.length || navigator.onLine === false) return; enviando = true;
  const lote = cola.slice(0, 200), body = JSON.stringify(lote);
  try {
    let ok = false;
    if (document.visibilityState === "hidden" && navigator.sendBeacon) ok = navigator.sendBeacon(API + "/api/eventos", new Blob([body], { type: "text/plain" }));
    else { const r = await fetch(API + "/api/eventos", { method: "POST", headers: { "content-type": "text/plain" }, body, keepalive: true }); ok = r.ok; }
    if (ok) { cola = cola.slice(lote.length); guardarCola(); }
  } catch (e) {}
  enviando = false;
}
setInterval(enviar, 30000);
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") enviar(); });

/* ---------- Funciona sin señal: la app se guarda en el cel (sw.js) ---------- */
if ("serviceWorker" in navigator && /(^|\.)palma-blanca-nfc\.netlify\.app$|\.github\.io$|^localhost$|^127\.0\.0\.1$/.test(location.hostname)) {
  window.addEventListener("load", () => { navigator.serviceWorker.register("sw.js").catch(() => {}); });
}
function avisoRed(txt) {
  let t = document.getElementById("pbRed");
  if (!t) { t = document.createElement("div"); t.id = "pbRed"; t.className = "pb-red"; t.setAttribute("role", "status"); document.body.appendChild(t); }
  t.textContent = txt; t.classList.add("on"); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("on"), 4200);
}
window.addEventListener("offline", () => avisoRed("Sin señal: las recetas y los juegos siguen funcionando."));
window.addEventListener("online", () => { avisoRed("Volvió la señal."); enviar(); });

/* Qué se registra: aperturas, secciones y acciones principales (en fase de captura,
   para que funcione aunque otros botones detengan el clic). */
try { if (!sessionStorage.getItem("pb.abierta")) { sessionStorage.setItem("pb.abierta", "1"); window.pbLog("app_abrir", new URLSearchParams(location.search).has("premio") ? "botella premiada" : (location.hash || "inicio")); } } catch (e) {}
let ultimaSeccion = "";
function seccion() { const h = (location.hash || "#inicio").slice(1).split("?")[0] || "inicio"; if (h !== ultimaSeccion && h !== "estadisticas") { ultimaSeccion = h; window.pbLog("seccion", h); } }
window.addEventListener("hashchange", seccion); seccion();
const txt = s => { const e = document.querySelector(s); return e ? e.textContent.trim() : ""; };
document.addEventListener("click", e => {
  const t = e.target; const c = sel => t.closest(sel);
  if (c("#spinBtn") || c("#resAgain")) window.pbLog("drink_giro", "");
  else if (c("#resRecipe") || (c("#machine") && !document.querySelector("#result")?.hidden)) window.pbLog("drink_receta", txt("#reel .dk-card b"));
  else if (c("#dGrid [data-fav]")) window.pbLog("drink_favorito", c("[data-fav]").dataset.fav);
  else if (c("#dGrid [data-dn]")) window.pbLog("drink_receta", c("[data-dn]").dataset.dn);
  else if (c("#quizOpen")) window.pbLog("drink_quiz", "");
  else if (c("#resShare") || c("#sShare") || c(".qz [data-qs]")) window.pbLog("drink_compartir", "");
  else if (c("#btGo")) window.pbLog("drink_bartender", "");
  else if (c("#jgOtro")) window.pbLog("juego_sorteo", "");
  else if (c("#jgPlay")) window.pbLog("juego_jugar", txt("#jgH"));
  else if (c("#jgMenu [data-gi]")) window.pbLog("juego_jugar", c("[data-gi]").textContent.trim());
  else { const lp = c("[data-lp]"), bd = c("[data-bd]");
    if (lp) { const m = lp.dataset.lp.match(/^startMode\('(\w+)'\)/); if (m) window.pbLog("peda_modo", m[1]); else if (/^endGame/.test(lp.dataset.lp)) window.pbLog("peda_fin", ""); else if (/^shareSummary/.test(lp.dataset.lp)) window.pbLog("peda_compartir", ""); }
    if (bd) { const k = bd.dataset.bd; if (k === "express") window.pbLog("cita_inicio", ""); else if (k === "empezar") window.pbLog("bd_inicio", ""); else if (k === "compartir") window.pbLog("bd_compartir", ""); }
  }
}, true);

/* ---------- Textos legales: Aviso de privacidad y Términos (textos en privacidad-data.js) ---------- */
function legalTxt(t) {
  const L = window.LEGAL || {};
  const contacto = L.contacto ? `<a href="mailto:${esc(L.contacto)}">${esc(L.contacto)}</a>` : `los canales de contacto de ${esc(L.sitio || "nuestro sitio web")}`;
  return esc(t)
    .replace(/\{responsable\}/g, esc(L.responsable || "Tequila Palma Blanca"))
    .replace(/\{domicilio\}/g, esc(L.domicilio || `el que aparece en ${L.sitio || "nuestro sitio web"}`))
    .replace(/\{instagram\}/g, esc(L.instagram || "@palma_blanca_tequila"))
    .replace(/\{permiso\}/g, L.permisoRifa ? `Permiso: ${esc(L.permisoRifa)}.` : "")
    .replace(/\{contacto\}/g, contacto);
}
function abrirLegal(P, seccion, evento) {
  if (!P) return;
  const ov = document.createElement("div"); ov.className = "pb-modal pb-priv-ov"; ov.setAttribute("role", "dialog"); ov.setAttribute("aria-modal", "true"); ov.setAttribute("aria-label", P.titulo);
  ov.innerHTML = `<div class="pb-modal-c pb-priv">
    <button class="pb-x" type="button" aria-label="Cerrar">×</button>
    <h2>${esc(P.titulo)}</h2><p class="pb-fecha">Actualizado: ${esc(P.actualizado || "")}</p>
    ${(P.secciones || []).map(s => `<h3${s.id ? ` id="legal-${esc(s.id)}"` : ""}>${esc(s.t)}</h3>${(s.p || []).map(x => `<p>${legalTxt(x)}</p>`).join("")}`).join("")}
    <button class="pb-ok" type="button">Entendido</button></div>`;
  document.body.appendChild(ov); lock(true);
  if (window.pbNavPush) window.pbNavPush();
  const cerrar = () => { ov.remove(); if (!document.querySelector(".pb-modal")) lock(false); };
  ov.querySelector(".pb-x").onclick = cerrar; ov.querySelector(".pb-ok").onclick = cerrar;
  ov.addEventListener("click", e => { if (e.target === ov) cerrar(); });
  if (seccion) { const h = ov.querySelector("#legal-" + seccion); if (h) setTimeout(() => h.scrollIntoView({ block: "start" }), 30); }
  window.pbLog(evento, seccion || "");
}
const abrirPrivacidad = () => abrirLegal(window.PRIVACIDAD, "", "privacidad_abrir");
window.pbPrivacidad = abrirPrivacidad;
document.addEventListener("click", e => {
  const b = e.target.closest("[data-privacidad],[data-terminos]"); if (!b) return;
  e.preventDefault(); e.stopPropagation();
  if (b.hasAttribute("data-privacidad")) abrirPrivacidad(); else abrirLegal(window.TERMINOS, b.dataset.terminos || "", "terminos_abrir");
}, true);

/* ---------- Aviso de +18 (pequeño, al abrir por primera vez) ---------- */
function avisoEdad() {
  if (LS.get("pb.edad") === "1") return;
  const ov = document.createElement("div"); ov.className = "pb-modal pb-edad-ov"; ov.setAttribute("role", "dialog"); ov.setAttribute("aria-modal", "true"); ov.setAttribute("aria-label", "Solo mayores de 18 años");
  ov.innerHTML = `<div class="pb-modal-c pb-edad">
    <div class="pb-edad-k">🌴 Tequila Palma Blanca</div>
    <h2>Solo para mayores de 18 años</h2>
    <p>Al continuar confirmas que eres mayor de edad. Disfruta con responsabilidad y, si tomas, no manejes.</p>
    <div class="pb-edad-acts"><button class="pb-ok" type="button" data-e="si">Tengo 18 o más</button><button class="pb-no" type="button" data-e="no">Soy menor</button></div>
    <button class="pb-link" type="button" data-privacidad>Aviso de privacidad</button> · <button class="pb-link" type="button" data-terminos>Términos</button>
  </div>`;
  document.body.appendChild(ov); lock(true);
  ov.addEventListener("click", e => {
    const b = e.target.closest("[data-e]"); if (!b) return;
    if (b.dataset.e === "si") { LS.set("pb.edad", "1"); window.pbLog("edad_ok", ""); ov.remove(); if (!document.querySelector(".pb-modal,.prize:not([hidden])")) lock(false); return; }
    window.pbLog("edad_menor", "");
    ov.querySelector(".pb-edad").innerHTML = `<div class="pb-edad-k">🌴 Tequila Palma Blanca</div><h2>Te esperamos cuando cumplas 18</h2><p>Esta app es solo para mayores de edad.</p>`;
  });
}
avisoEdad();

/* ---------- Estadísticas para el staff (#estadisticas) ---------- */
const NOMBRES = {
  app_abrir: "Aperturas de la app", seccion: "Secciones abiertas", edad_ok: "Confirmaron +18", edad_menor: "Dijeron ser menores",
  drink_giro: "Giros del drink del día", drink_receta: "Recetas abiertas", drink_personas: "Recetas para varias personas", drink_quiz: "Quiz «¿Qué drink eres?»",
  drink_compartir: "Drinks compartidos", drink_favorito: "Favoritos", drink_bartender: "Modo bartender",
  juego_sorteo: "Giros de «¿A ver qué te toca?»", juego_jugar: "Juegos iniciados",
  peda_modo: "Partidas de La Peda", peda_fin: "Partidas terminadas", peda_compartir: "Resúmenes compartidos",
  bd_inicio: "Partidas de Cita a Ciegas (en pareja)", cita_inicio: "Partidas de Cupido en la Mesa (todos juegan)", bd_compartir: "Resultados de Cita a Ciegas / Cupido compartidos",
  apertura: "Modo Antro abierto", registro: "Entradas al Modo Antro", ruleta: "Giros de la ruleta del Antro", paso: "«Paso» en el Antro",
  foto_muro: "Fotos subidas al muro", foto_borrada: "Fotos borradas", regalo: "Regalos ganados (ruleta)", regalo_reclamado: "Regalos reclamados",
  premio: "Premios del Antro canjeados", reto: "Retos hechos", mesa_vs_mesa: "Retos mesa vs mesa", botella: "Retos de la botella",
  trivia: "Trivias terminadas", modo_sobrio: "Cambios a sin alcohol", privacidad_abrir: "Aviso de privacidad abierto", terminos_abrir: "Términos y bases abiertos",
  certificado: "Certificados de bartender"
};
function estadisticas() {
  if ((location.hash || "") !== "#estadisticas" || document.querySelector(".pb-stats")) return;
  const ov = document.createElement("div"); ov.className = "pb-modal pb-stats"; ov.setAttribute("role", "dialog"); ov.setAttribute("aria-modal", "true"); ov.setAttribute("aria-label", "Estadísticas");
  ov.innerHTML = `<div class="pb-modal-c">
    <button class="pb-x" type="button" aria-label="Cerrar">×</button>
    <h2>Estadísticas</h2><p class="pb-fecha">Solo para el staff de Palma Blanca. Datos anónimos.</p>
    <form class="pb-pin"><input type="password" autocomplete="off" placeholder="PIN del staff" aria-label="PIN del staff"><select aria-label="Periodo"><option value="1">Hoy</option><option value="7" selected>7 días</option><option value="30">30 días</option></select><button class="pb-ok" type="submit">Ver</button></form>
    <div class="pb-res" aria-live="polite"></div></div>`;
  document.body.appendChild(ov); lock(true);
  const cerrar = () => { ov.remove(); lock(false); history.replaceState(null, "", location.pathname + location.search); };
  ov.querySelector(".pb-x").onclick = cerrar;
  const res = ov.querySelector(".pb-res");
  ov.querySelector("form").onsubmit = async e => {
    e.preventDefault();
    const pin = ov.querySelector("input").value, dias = ov.querySelector("select").value;
    if (!pin) { res.textContent = "Escribe el PIN."; return; }
    res.textContent = "Cargando…";
    try {
      const r = await fetch(API + "/api/eventos?dias=" + dias, { headers: { "x-staff-pin": pin }, cache: "no-store" });
      if (r.status === 403) { res.textContent = "PIN incorrecto."; return; }
      const d = await r.json(), porDia = d.dias || {}, total = {};
      Object.values(porDia).forEach(c => Object.entries(c).forEach(([k, n]) => { total[k] = (total[k] || 0) + n; }));
      const filas = Object.entries(total).sort((a, b) => b[1] - a[1]);
      if (!filas.length) { res.innerHTML = "<p>Todavía no hay datos en este periodo.</p>"; return; }
      res.innerHTML = `<div class="pb-tot">${filas.map(([k, n]) => `<div><span>${esc(NOMBRES[k] || (k.startsWith("certificado:") ? "Certificados · " + k.slice(12) : k))}</span><b>${n}</b></div>`).join("")}</div>
        <h3>Por día</h3><div class="pb-dias">${Object.keys(porDia).sort().reverse().map(dia => { const c = porDia[dia], t = Object.entries(c).filter(([k]) => !k.includes(":")).reduce((a, [, b]) => a + b, 0); return `<div><span>${esc(dia)}</span><span>${t} eventos · ${c.app_abrir || 0} aperturas</span></div>`; }).join("")}</div>`;
    } catch (err) { res.textContent = API ? "Desde este link no se pueden ver. Abre palma-blanca-nfc.netlify.app/#estadisticas" : "No se pudo conectar."; }
  };
}
window.addEventListener("hashchange", estadisticas); estadisticas();

/* ---------- Barra superior en todas las secciones: ‹ Atrás · logo · Inicio ----------
   - «‹ Atrás» regresa a la pantalla anterior (receta → lista, quiz → Drinks, cartas → modos…).
   - El botón de atrás del cel hace lo mismo: cada pantalla interna agrega un paso al historial.
   - El logo y la casita llevan al inicio. */
const nav = document.createElement("nav");
nav.className = "pb-nav"; nav.hidden = true; nav.setAttribute("aria-label", "Navegación");
const logoSrc = window.__pbLogo || "";
nav.innerHTML = `<button type="button" class="pb-nav-atras">‹ Atrás</button>
  <button type="button" class="pb-nav-logo" aria-label="Palma Blanca · ir al inicio"><span class="pb-nav-mark" style="-webkit-mask-image:url('${logoSrc}');mask-image:url('${logoSrc}')"></span></button>
  <button type="button" class="pb-nav-casa" aria-label="Inicio"><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M3.5 11 12 4l8.5 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 9.8V20h4.5v-5.5h3V20H18V9.8" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg></button>`;
document.body.appendChild(nav);
const $q = s => document.querySelector(s);
const navSec = () => (location.hash || "").replace("#", "");
const SECCIONES = ["drinks", "peda", "antro", "quien"];

/* Historial interno */
let pasos = 0, ignorar = false, regresando = false;
window.pbNavPush = function () { if (regresando) return; try { history.pushState({ pbn: Date.now() }, "", location.href); pasos++; } catch (e) {} };
function irInicio() {
  pasos = 0;
  document.querySelectorAll("body > .story, .pb-logros").forEach(n => n.remove());
  if ($q(".sheet.on")) $q("#sClose").click();
  const qz = $q(".qz:not([hidden])"); if (qz) { const x = qz.querySelector("[data-qx]"); if (x) x.click(); }
  history.replaceState(null, "", location.pathname + location.search);
  window.dispatchEvent(new HashChangeEvent("hashchange"));
}
/* Cierra lo de más arriba o regresa un nivel. Devuelve true si hizo algo. */
function unPaso(desdeHistorial) {
  regresando = true;
  try {
    const story = [...document.querySelectorAll("body > .story")].pop();
    if (story) { const x = story.querySelector("[data-x], .cert-x"); x ? x.click() : story.remove(); return true; }
    const bt = $q(".bt:not([hidden])"); if (bt) { const x = bt.querySelector(".bt-x, [data-btx]"); if (x) { x.click(); return true; } }
    const pm = [...document.querySelectorAll(".pb-modal:not(.pb-edad-ov)")].pop();
    if (pm) { const x = pm.querySelector(".pb-x, [data-x]"); x ? x.click() : pm.remove(); return true; }
    const qz = $q(".qz:not([hidden])"); if (qz) { const x = qz.querySelector("[data-qx]"); if (x) { x.click(); return true; } }
    if ($q(".sheet.on")) { $q("#sClose").click(); return true; }
    const s = navSec();
    if (s === "peda") { const a = $q("#lp .screen.active"); if (a && a.id !== "intro" && typeof window.lpAtras === "function") { window.lpAtras(); return true; } }
    if (s === "quien") { const b = $q("#jgBack"); if (b && !b.hasAttribute("data-go")) { b.click(); return true; } }
    if (s === "antro") { const b = [...document.querySelectorAll(".atras-antro")].find(e => e.offsetParent); if (b) { b.click(); return true; } }
    if (desdeHistorial) return false;
    irInicio(); return true;
  } finally { regresando = false; }
}
window.addEventListener("popstate", () => {
  if (ignorar) { ignorar = false; return; }
  if (pasos > 0) { pasos--; unPaso(true); }
});
window.addEventListener("hashchange", () => { if (!SECCIONES.includes(navSec())) pasos = 0; });
nav.querySelector(".pb-nav-atras").onclick = () => { unPaso(false); if (pasos > 0) { pasos--; ignorar = true; history.back(); } };
nav.querySelector(".pb-nav-logo").onclick = irInicio;
nav.querySelector(".pb-nav-casa").onclick = irInicio;

/* La Peda: cada pantalla nueva agrega un paso al historial */
if (typeof window.go === "function") {
  const irLP = window.go;
  window.go = function (id) { const r = irLP.apply(this, arguments); if (navSec() === "peda" && id !== "intro") window.pbNavPush(); pintar(); return r; };
}

/* Logo azul marino en fondos claros y blanco hueso en fondos oscuros; más tenue en las cartas */
function pintar() {
  const s = navSec(), story = document.querySelector("body > .story"), bt = $q(".bt:not([hidden])");
  const ver = SECCIONES.includes(s) && !story && !bt;
  nav.hidden = !ver; document.body.classList.toggle("pb-navon", ver);
  if (!ver) return;
  let claro = s === "drinks";
  if (document.querySelector(".pb-modal") || $q(".sheet.on")) claro = false;
  if ($q(".qz:not([hidden])")) claro = true;
  nav.classList.toggle("pb-nav-claro", claro);
  const a = s === "peda" && $q("#lp .screen.active");
  nav.classList.toggle("pb-nav-juego", !!(a && /^(game|bdgame)$/.test(a.id)));
}
let pend = false;
const programar = () => { if (pend) return; pend = true; requestAnimationFrame(() => { pend = false; pintar(); }); };
new MutationObserver(programar).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["hidden", "class"] });
window.addEventListener("hashchange", programar);
pintar();
})();
