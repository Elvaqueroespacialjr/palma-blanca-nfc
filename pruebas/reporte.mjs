// Lee salida/resultados.json y escribe salida/resultados.csv, salida/estadisticas.json y salida/reporte.html
// Los hallazgos («Lo más importante») se escriben a mano en hallazgos.json después de revisar los datos.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import vm from "node:vm";

const AQUI = dirname(fileURLToPath(import.meta.url)), SALIDA = join(AQUI, "salida"), PUB = process.env.APP_DIR || join(AQUI, "snapshot-app");  // copia fija de la app que se probó
const { meta, resultados: S } = JSON.parse(readFileSync(join(SALIDA, "resultados.json"), "utf8"));

/* ---------- Datos de la app (para saber qué se espera) ---------- */
const html = readFileSync(join(PUB, "index.html"), "utf8");
const DRINKS = [...html.matchAll(/^ \{n:"([^"]+)",a:/gm)].map(m => m[1]);
const QUIZ = vm.runInNewContext(html.match(/const QUIZ=(\[[\s\S]*?\n\]);/)[1]);
const sb = { window: {} }; vm.runInNewContext(readFileSync(join(PUB, "antro-data.js"), "utf8"), sb);
const AD = sb.window.ANTRO_DATA;
const sbj = { window: {} }; vm.runInNewContext(readFileSync(join(PUB, "juegos-data.js"), "utf8"), sbj);
const JUEGOS = (Object.values(sbj.window).find(v => v && Array.isArray(v.juegos)) || {}).juegos?.map(j => j.nombre) || [];

/* ---------- Utilidades estadísticas ---------- */
function gammaLn(x) { const c = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5]; let y = x, t = x + 5.5; t -= (x + 0.5) * Math.log(t); let s = 1.000000000190015; for (const k of c) s += k / ++y; return -t + Math.log(2.5066282746310005 * s / x); }
function gammaQ(a, x) { // P(chi² > x) con a = gl/2
  if (x <= 0) return 1; const gln = gammaLn(a);
  if (x < a + 1) { let sum = 1 / a, del = sum, ap = a; for (let n = 0; n < 300; n++) { ap++; del *= x / ap; sum += del; if (Math.abs(del) < Math.abs(sum) * 1e-12) break; } return 1 - sum * Math.exp(-x + a * Math.log(x) - gln); }
  let b = x + 1 - a, c = 1e300, d = 1 / b, h = d; for (let i = 1; i < 300; i++) { const an = -i * (i - a); b += 2; d = an * d + b; if (Math.abs(d) < 1e-300) d = 1e-300; c = b + an / c; if (Math.abs(c) < 1e-300) c = 1e-300; d = 1 / d; const del = d * c; h *= del; if (Math.abs(del - 1) < 1e-12) break; }
  return Math.exp(-x + a * Math.log(x) - gln) * h;
}
/* obs y esp: objetos categoría → conteo / conteo esperado */
function chi2(obs, esp) {
  const cats = Object.keys(esp).filter(k => esp[k] > 0);
  const n = cats.reduce((t, k) => t + (obs[k] || 0), 0);
  let x = 0; cats.forEach(k => { const o = obs[k] || 0, e = esp[k]; x += (o - e) ** 2 / e; });
  const gl = cats.length - 1, p = gl > 0 ? gammaQ(gl / 2, x / 2) : 1;
  const minEsp = Math.min(...cats.map(k => esp[k]));
  const suficiente = minEsp >= 5;
  const veredicto = n === 0 ? "sin datos" : !suficiente ? `datos insuficientes (se esperan ${minEsp.toFixed(1)} por casilla; hacen falta al menos 5)` : p < 0.05 ? "hay sesgo (p < 0.05)" : "parejo: no hay evidencia de sesgo";
  return { n, chi2: +x.toFixed(2), gl, p: +p.toFixed(4), min_esperado: +minEsp.toFixed(2), suficiente, veredicto, obs, esp: Object.fromEntries(cats.map(k => [k, +esp[k].toFixed(2)])) };
}
const add = (o, k, v = 1) => { o[k] = (o[k] || 0) + v; };
const media = a => a.length ? a.reduce((t, x) => t + x, 0) / a.length : null;
const p95 = a => { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.ceil(0.95 * s.length) - 1)]; };
const r0 = x => x == null ? null : Math.round(x);

/* ---------- 1. Tragamonedas «drink del día» ---------- */
const slotObs = {}, slotEsp = Object.fromEntries(DRINKS.map(d => [d, 0]));
S.forEach(s => s.slot.forEach(g => { add(slotObs, g.resultado); const pool = DRINKS.filter(d => d !== g.antes); pool.forEach(d => slotEsp[d] += 1 / pool.length); }));
const slotRepetidos = S.flatMap(s => s.slot).filter(g => g.antes === g.resultado).length;

/* ---------- 2. Ruleta del Modo Antro (con pesos y la regla de 15 min sin shots) ---------- */
const tit2id = {}; AD.casillas.forEach(c => { tit2id[c.titulo] ??= c.id; }); const canon = c => tit2id[c.titulo];
const ruletaObs = {}, ruletaEsp = {};
const pRegalo = Number(AD.ronda?.probabilidad || 0);
S.forEach(s => s.ruleta.forEach(g => {
  const cas = AD.casillas.find(c => c.id === g.id), id = cas ? canon(cas) : g.id; add(ruletaObs, id);  // casillas repetidas cuentan juntas
  const pool = AD.casillas.filter(c => !(g.frio && c.alcohol)); const W = pool.reduce((t, c) => t + (c.peso ?? 1), 0);
  pool.forEach(c => add(ruletaEsp, canon(c), (1 - pRegalo) * (c.peso ?? 1) / W)); add(ruletaEsp, "regalo", pRegalo);
}));
const tituloDe = id => id === "regalo" ? "Regalo (casilla dorada)" : (AD.casillas.find(c => c.id === id)?.titulo || id);

/* ---------- 3. Quiz: distribución esperada si se contesta al azar ---------- */
const quizEsp1 = {};
for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) for (let c = 0; c < 4; c++) for (let d = 0; d < 4; d++) {
  const sc = {}; [a, b, c, d].forEach((o, q) => { const op = QUIZ[q].o[o]; add(sc, op[1], 2); add(sc, op[2], 1); });
  const m = Math.max(...Object.values(sc)), tops = Object.keys(sc).filter(k => sc[k] === m); tops.forEach(t => add(quizEsp1, t, 1 / tops.length / 256));
}
const quizObs = {}; const quizN = S.filter(s => s.quiz).length; S.forEach(s => s.quiz && add(quizObs, s.quiz.resultado));
const quizEsp = Object.fromEntries(DRINKS.map(d => [d, (quizEsp1[d] || 0) * quizN]));

/* ---------- 4. ¿A ver qué te toca? (ruleta de juegos) y El Dedo ---------- */
const jgObs = {}, jgEsp = Object.fromEntries(JUEGOS.map(j => [j, 0]));
S.forEach(s => s.juegos_ruleta.forEach(g => { add(jgObs, g.resultado); const pool = JUEGOS.filter(j => j !== g.antes); pool.forEach(j => jgEsp[j] += 1 / pool.length); }));
const dedoObs = {}, dedoEsp = {}; let dedoRondas = 0, dedoSinEleccion = 0, dedoQuito = 0;
S.forEach(s => s.dedo.forEach(d => {
  if (d.quito_antes) { dedoQuito++; return; }
  dedoRondas++; if (d.ganador < 0) { dedoSinEleccion++; return; }
  add(dedoObs, "Dedo " + (d.ganador + 1)); for (let i = 0; i < d.dedos; i++) add(dedoEsp, "Dedo " + (i + 1), 1 / d.dedos);
}));
const dedoQuitoEligio = S.flatMap(s => s.dedo).filter(d => d.quito_antes && d.eligio).length;
/* Prueba enfocada (dedo.mjs): identifica al ganador por la posición del dedo; reemplaza a la medición de la simulación general */
const dedoFoco = existsSync(join(SALIDA, "dedo.json")) ? JSON.parse(readFileSync(join(SALIDA, "dedo.json"), "utf8")) : null;
if (dedoFoco) {
  Object.keys(dedoObs).forEach(k => delete dedoObs[k]); Object.keys(dedoEsp).forEach(k => delete dedoEsp[k]);
  dedoFoco.forEach(d => { if (d.ganador < 0) return; add(dedoObs, "Dedo " + (d.ganador + 1)); for (let i = 0; i < d.dedos; i++) add(dedoEsp, "Dedo " + (i + 1), 1 / d.dedos); });
}

/* ---------- 5. La Peda: reparto de cartas ---------- */
const partidas = S.filter(s => s.peda);
const pedaJusta = partidas.map(s => { const v = Object.values(s.peda.porJugador); return { id: s.id, jugadores: s.peda.jugadores, cartas: s.peda.cartas, leidas: v.reduce((t, x) => t + x, 0), maxmin: v.length ? Math.max(...v) - Math.min(...v) : 0, sinCarta: s.peda.sinCarta, chi: v.length > 1 ? chi2(s.peda.porJugador, Object.fromEntries(Object.keys(s.peda.porJugador).map(k => [k, v.reduce((t, x) => t + x, 0) / v.length]))) : null }; });

/* ---------- 6. Errores, desbordes, atorados ---------- */
const porCel = {}, porSec = {};
S.forEach(s => {
  const c = porCel[s.celular] ??= { sesiones: 0, con_error: 0, errores: 0, atorados: 0, desbordes: 0, tapados: 0 };
  c.sesiones++; c.errores += s.errores.length; if (s.errores.length) c.con_error++; c.atorados += s.atorados.length; c.desbordes += s.desbordes.length; c.tapados += s.tapados.length;
  const visitadas = new Set(s.recorrido.map(x => x.split("/")[0]));
  visitadas.forEach(v => { (porSec[v] ??= { sesiones: 0, errores: 0, atorados: 0, sesiones_con_problema: 0 }).sesiones++; });
  const conProb = new Set();
  s.errores.forEach(e => { const k = (e.seccion || "inicio").split("/")[0]; (porSec[k] ??= { sesiones: 0, errores: 0, atorados: 0, sesiones_con_problema: 0 }).errores++; conProb.add(k); });
  s.atorados.forEach(e => { const k = (e.seccion || "inicio").split("/")[0]; (porSec[k] ??= { sesiones: 0, errores: 0, atorados: 0, sesiones_con_problema: 0 }).atorados++; conProb.add(k); });
  conProb.forEach(k => porSec[k].sesiones_con_problema++);
});
const agrupa = (arr, f) => { const o = {}; arr.forEach(x => { const k = f(x); (o[k] ??= { veces: 0, ejemplo: x }).veces++; }); return Object.entries(o).sort((a, b) => b[1].veces - a[1].veces); };
const erroresTop = agrupa(S.flatMap(s => s.errores.map(e => ({ ...e, celular: s.celular, sesion: s.id }))), e => e.tipo + " · " + e.msg.slice(0, 120));
const atoradosTop = agrupa(S.flatMap(s => s.atorados.map(e => ({ ...e, celular: s.celular, sesion: s.id }))), e => e.accion + " · " + e.motivo.slice(0, 90));
const desbordesTop = agrupa(S.flatMap(s => s.desbordes.map(e => ({ ...e, celular: s.celular, sesion: s.id }))), e => e.accion + " · " + e.pantalla + "px");
const tapadosTop = agrupa(S.flatMap(s => s.tapados.map(e => ({ ...e, celular: s.celular, sesion: s.id }))), e => e.accion + " · lo tapa " + e.lo_tapa);

/* ---------- 7. Tiempos ---------- */
const tiempos = {
  "Carga inicial (DOM listo)": S.map(s => s.carga_dcl_ms).filter(x => x != null),
  "Carga inicial (todo)": S.map(s => s.carga_total_ms).filter(x => x != null),
  "Giro del drink del día": S.flatMap(s => s.slot.map(g => g.ms)),
  "Giro de la ruleta del Antro": S.flatMap(s => s.ruleta.map(g => g.ms)),
  "Giro de ¿A ver qué te toca?": S.flatMap(s => s.juegos_ruleta.map(g => g.ms))
};
const tiemposRes = Object.fromEntries(Object.entries(tiempos).map(([k, v]) => [k, { n: v.length, promedio: r0(media(v)), p95: r0(p95(v)) }]));

/* ---------- 8. Embudos ---------- */
const emb = p => S.filter(s => s.perfil === p);
const embudos = {
  "Curiosa de drinks": { sesiones: emb("Curiosa de drinks").length, "abrió el quiz": emb("Curiosa de drinks").filter(s => s.embudo.quiz_inicio).length, "terminó el quiz": emb("Curiosa de drinks").filter(s => s.embudo.quiz_fin).length },
  "Pre con amigos": { sesiones: emb("Pre con amigos").length, "empezó La Peda": emb("Pre con amigos").filter(s => s.embudo.peda_inicio).length, "llegó al resumen": emb("Pre con amigos").filter(s => s.embudo.peda_resumen).length },
  "En el antro": { sesiones: emb("En el antro").length, "entró al Modo Antro": emb("En el antro").filter(s => s.embudo.antro_inicio).length, "pasó la edad": emb("En el antro").filter(s => s.embudo.antro_edad).length, "llegó a la ruleta (registro completo)": emb("En el antro").filter(s => s.embudo.antro_ruleta).length },
  "Rápido": { sesiones: emb("Rápido").length, "duró menos de 30 s": emb("Rápido").filter(s => s.duracion_ms < 30000).length },
  "Botella premiada": { sesiones: emb("Botella premiada").length, "vio su boleto": emb("Botella premiada").filter(s => s.premio && s.premio.mostrado).length }
};

/* ---------- 9. Premios ---------- */
const prem = S.filter(s => s.premio).map(s => s.premio);
const premios = {
  validos_probados: prem.filter(p => p.esperado === "válido").length,
  validos_aceptados: prem.filter(p => p.esperado === "válido" && p.aceptado).length,
  invalidos_probados: prem.filter(p => p.esperado === "inválido").length,
  invalidos_aceptados_por_error: prem.filter(p => p.esperado === "inválido" && p.aceptado).length,
  invalidos_guardados_en_mis_premios: prem.filter(p => p.esperado === "inválido" && p.en_mis_premios).length,
  por_tipo: agrupa(prem, p => p.tipo + " → " + p.mostrado).map(([k, v]) => [k, v.veces])
};

/* ---------- 10. Recorrido y abandono ---------- */
const abandono = {}; S.forEach(s => add(abandono, s.abandono || "inicio"));
const rutas = agrupa(S, s => s.recorrido.join(" → ")).slice(0, 10).map(([k, v]) => [k, v.veces]);

const est = {
  meta, total: S.length, por_perfil: Object.fromEntries(Object.keys(embudos).map(p => [p, emb(p).length])),
  pruebas: {
    "Drink del día (tragamonedas)": chi2(slotObs, slotEsp),
    "Ruleta del Modo Antro": chi2(ruletaObs, ruletaEsp),
    "Quiz «¿Qué drink eres?»": chi2(quizObs, quizEsp),
    "Ruleta de ¿A ver qué te toca?": chi2(jgObs, jgEsp),
    "El Dedo (qué dedo gana)": chi2(dedoObs, dedoEsp)
  },
  slot_repetidos: slotRepetidos, dedo: { rondas: dedoRondas, sin_eleccion: dedoSinEleccion, quito_antes: dedoQuito, quito_antes_y_eligio: dedoQuitoEligio },
  peda: { partidas: partidas.length, cartas_promedio: r0(media(partidas.map(s => s.peda.cartas))), con_alguien_sin_carta: pedaJusta.filter(x => x.sinCarta > 0).length, diferencia_max_min_mayor_a_1: pedaJusta.filter(x => x.maxmin > 1).length, completas: pedaJusta.filter(x => x.leidas === x.cartas).length, completas_disparejas: pedaJusta.filter(x => x.leidas === x.cartas && x.maxmin > 1).length, detalle: pedaJusta },
  por_celular: porCel, por_seccion: porSec, errores_top: erroresTop.slice(0, 15).map(([k, v]) => ({ que: k, veces: v.veces, ejemplo: v.ejemplo })),
  atorados_top: atoradosTop.slice(0, 15).map(([k, v]) => ({ que: k, veces: v.veces, ejemplo: v.ejemplo })),
  desbordes_top: desbordesTop.slice(0, 10).map(([k, v]) => ({ que: k, veces: v.veces, ejemplo: v.ejemplo })),
  tapados_top: tapadosTop.slice(0, 10).map(([k, v]) => ({ que: k, veces: v.veces, ejemplo: v.ejemplo })),
  tiempos: tiemposRes, embudos, premios, abandono, rutas
};
writeFileSync(join(SALIDA, "estadisticas.json"), JSON.stringify(est, null, 1));

/* ---------- resultados.csv (una fila por sesión) ---------- */
const col = ["id", "perfil", "celular", "regresa", "carga_dcl_ms", "carga_total_ms", "duracion_s", "acciones", "recorrido", "abandono", "errores", "atorados", "desbordes", "tapados", "giros_drink", "drinks_salieron", "giros_ruleta", "ruleta_salio", "quiz_resultado", "peda_modo", "peda_jugadores", "peda_cartas", "peda_sin_carta", "peda_dif_max_min", "giros_juegos", "dedo_rondas", "dedo_ganadores", "premio_codigo", "premio_tipo", "premio_mostrado", "premio_aceptado", "quiz_terminado", "peda_resumen", "antro_registro", "rarezas"];
const q = v => { const t = v == null ? "" : String(v); return /[",\n;]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
const filas = S.map(s => { const pj = s.peda ? Object.values(s.peda.porJugador) : []; return [s.id, s.perfil, s.celular, s.regresa ? "sí" : "no", s.carga_dcl_ms, s.carga_total_ms, (s.duracion_ms / 1000).toFixed(1), s.acciones, s.recorrido.join(" > "), s.abandono, s.errores.length, s.atorados.length, s.desbordes.length, s.tapados.length, s.slot.length, s.slot.map(g => g.resultado).join(" | "), s.ruleta.length, s.ruleta.map(g => g.id).join(" | "), s.quiz?.resultado || "", s.peda?.modo || "", s.peda?.jugadores ?? "", s.peda?.cartas ?? "", s.peda?.sinCarta ?? "", pj.length ? Math.max(...pj) - Math.min(...pj) : "", s.juegos_ruleta.length, s.dedo.length, s.dedo.map(d => d.ganador >= 0 ? d.ganador + 1 + "/" + d.dedos : "ninguno/" + d.dedos).join(" | "), s.premio?.codigo || "", s.premio?.tipo || "", s.premio?.mostrado || "", s.premio ? (s.premio.aceptado ? "sí" : "no") : "", s.embudo.quiz_fin ? "sí" : "no", s.embudo.peda_resumen ? "sí" : "no", s.embudo.antro_ruleta ? "sí" : "no", s.rarezas.join(" | ")].map(q).join(","); });
writeFileSync(join(SALIDA, "resultados.csv"), "\ufeff" + [col.join(","), ...filas].join("\n"));

/* =====================================================================
   REPORTE HTML
   ===================================================================== */
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const hallazgos = existsSync(join(AQUI, "hallazgos.json")) ? JSON.parse(readFileSync(join(AQUI, "hallazgos.json"), "utf8")) : [];
const pct = (a, b) => b ? Math.round(a / b * 100) + "%" : "—";

/* Barras horizontales: observado (barra) vs esperado (marca) */
function barras(titulo, prueba, etiqueta = k => k) {
  const cats = Object.keys(prueba.esp).sort((a, b) => (prueba.esp[b] - prueba.esp[a]) || a.localeCompare(b));
  const max = Math.max(1, ...cats.map(k => Math.max(prueba.obs[k] || 0, prueba.esp[k])));
  const filas = cats.map(k => { const o = prueba.obs[k] || 0, e = prueba.esp[k];
    return `<div class="fila" tabindex="0" data-tip="${esc(etiqueta(k))}: salió ${o} ${o === 1 ? "vez" : "veces"}, se esperaban ${e.toFixed(1)}"><span class="et">${esc(etiqueta(k))}</span><span class="pista"><span class="barra" style="width:${o / max * 100}%"></span><span class="esp" style="left:${e / max * 100}%"></span></span><span class="num">${o}</span></div>`; }).join("");
  return `<figure class="graf"><figcaption><b>${esc(titulo)}</b><span>${prueba.n} resultados · χ² = ${prueba.chi2}, p = ${prueba.p}</span></figcaption>
    <div class="leyenda"><span><i class="sw-barra"></i>Veces que salió</span><span><i class="sw-esp"></i>Lo esperado si fuera justo</span></div>
    <div class="filas">${filas}</div><p class="veredicto ${prueba.suficiente ? (prueba.p < 0.05 ? "mal" : "bien") : "neutro"}">${esc(prueba.veredicto)}</p>
    <details><summary>Ver tabla</summary><table><tr><th>Resultado</th><th>Salió</th><th>Esperado</th></tr>${cats.map(k => `<tr><td>${esc(etiqueta(k))}</td><td>${prueba.obs[k] || 0}</td><td>${prueba.esp[k].toFixed(1)}</td></tr>`).join("")}</table></details></figure>`;
}
function barrasSimples(titulo, sub, datos, fmt = v => v) {
  const max = Math.max(1, ...datos.map(d => d[1]));
  return `<figure class="graf"><figcaption><b>${esc(titulo)}</b><span>${esc(sub)}</span></figcaption><div class="filas">${datos.map(([k, v, tip]) => `<div class="fila" tabindex="0" data-tip="${esc(tip || k + ": " + fmt(v))}"><span class="et">${esc(k)}</span><span class="pista"><span class="barra" style="width:${v / max * 100}%"></span></span><span class="num">${esc(fmt(v))}</span></div>`).join("")}</div></figure>`;
}
const tabla = (cab, filas) => `<div class="tabla"><table><tr>${cab.map(c => `<th>${esc(c)}</th>`).join("")}</tr>${filas.map(f => `<tr>${f.map(c => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</table></div>`;
const totErr = S.reduce((t, s) => t + s.errores.length, 0), totAt = S.reduce((t, s) => t + s.atorados.length, 0), totDes = S.reduce((t, s) => t + s.desbordes.length, 0);

const page = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Simulaciones Palma Blanca</title>
<style>
:root{--surface-1:#fcfcfb;--surface-2:#f2f1ed;--text-primary:#0b0b0b;--text-secondary:#52514e;--text-muted:#7a7974;--grid:#e3e2dc;--series-1:#2a78d6;--good:#0a7a3e;--bad:#c43b3b;--line:#d8d6cf;color-scheme:light}
@media (prefers-color-scheme:dark){:root:where(:not([data-theme="light"])){--surface-1:#1a1a19;--surface-2:#242422;--text-primary:#f0efec;--text-secondary:#c3c2b7;--text-muted:#9a998f;--grid:#333330;--series-1:#3987e5;--good:#3fbf74;--bad:#e66767;--line:#3a3a36;color-scheme:dark}}
:root[data-theme="dark"]{--surface-1:#1a1a19;--surface-2:#242422;--text-primary:#f0efec;--text-secondary:#c3c2b7;--text-muted:#9a998f;--grid:#333330;--series-1:#3987e5;--good:#3fbf74;--bad:#e66767;--line:#3a3a36;color-scheme:dark}
*{box-sizing:border-box}body{margin:0;background:var(--surface-1);color:var(--text-primary);font:15px/1.55 system-ui,-apple-system,"Segoe UI",sans-serif}
main{max-width:980px;margin:0 auto;padding:28px 16px 60px}h1{font-size:28px;margin:0 0 4px}h2{font-size:20px;margin:40px 0 12px;padding-top:12px;border-top:1px solid var(--line)}
.sub{color:var(--text-secondary);margin:0 0 18px}.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}
.kpi{background:var(--surface-2);border-radius:12px;padding:12px 14px}.kpi b{display:block;font-size:26px;font-variant-numeric:tabular-nums}.kpi span{color:var(--text-secondary);font-size:13px}
.hall{display:grid;gap:12px}.hall article{background:var(--surface-2);border-radius:12px;padding:14px 16px;border-left:4px solid var(--text-muted)}
.hall article.g-alta{border-left-color:var(--bad)}.hall h3{margin:0 0 6px;font-size:16px}.hall dl{display:grid;grid-template-columns:auto 1fr;gap:4px 12px;margin:0}.hall dt{color:var(--text-secondary);font-weight:600}.hall dd{margin:0}
@media (max-width:560px){.hall dl{grid-template-columns:1fr}.hall dd{margin-bottom:6px}}
.etq{display:inline-block;font-size:12px;font-weight:700;padding:2px 8px;border-radius:99px;background:var(--surface-1);margin-left:6px;color:var(--text-secondary)}
.grid2{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:16px}
.graf{margin:0;background:var(--surface-2);border-radius:12px;padding:14px}.graf figcaption{display:grid;gap:2px;margin-bottom:8px}.graf figcaption span{color:var(--text-secondary);font-size:13px}
.leyenda{display:flex;gap:14px;font-size:12.5px;color:var(--text-secondary);margin-bottom:8px}.leyenda span{display:flex;align-items:center;gap:6px}
.sw-barra{width:14px;height:8px;border-radius:2px;background:var(--series-1);display:inline-block}.sw-esp{width:2px;height:12px;background:var(--text-primary);display:inline-block}
.filas{display:grid;gap:4px}.fila{display:grid;grid-template-columns:minmax(90px,38%) 1fr 34px;align-items:center;gap:8px;font-size:13px;border-radius:6px;padding:1px 2px;position:relative}
.fila:hover,.fila:focus{background:var(--surface-1);outline:none}.et{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text-secondary)}
.pista{position:relative;height:14px;background:linear-gradient(90deg,var(--grid) 1px,transparent 1px) 0 0/25% 100%}.barra{position:absolute;left:0;top:2px;bottom:2px;background:var(--series-1);border-radius:0 4px 4px 0}
.esp{position:absolute;top:-2px;bottom:-2px;width:2px;margin-left:-1px;background:var(--text-primary)}.num{text-align:right;font-variant-numeric:tabular-nums}
.veredicto{margin:10px 0 0;font-weight:600}.veredicto.bien{color:var(--good)}.veredicto.mal{color:var(--bad)}.veredicto.neutro{color:var(--text-secondary)}
details{margin-top:8px;font-size:13px}summary{cursor:pointer;color:var(--text-secondary)}
.tabla{overflow-x:auto}table{border-collapse:collapse;width:100%;font-size:13px;margin-top:6px}th,td{text-align:left;padding:6px 8px;border-bottom:1px solid var(--line);vertical-align:top}th{color:var(--text-secondary);font-weight:600}
td{font-variant-numeric:tabular-nums}#tip{position:fixed;pointer-events:none;background:var(--text-primary);color:var(--surface-1);font-size:12.5px;padding:6px 9px;border-radius:6px;max-width:260px;opacity:0;transition:opacity .1s;z-index:5}
.nota{font-size:13px;color:var(--text-secondary)}code{font-size:12.5px}
</style></head><body><main>
<h1>Simulaciones de la app Palma Blanca</h1>
<p class="sub">${est.total} personas simuladas en celulares · ${new Date(meta.fecha).toLocaleString("es-MX", { dateStyle: "long", timeStyle: "short" })} · servidor ${esc(meta.base)} · semilla ${meta.semilla}${meta.escala_tiempo !== 1 ? ` · tiempos humanos ×${meta.escala_tiempo}` : ""}</p>
<div class="kpis">
 <div class="kpi"><b>${est.total}</b><span>sesiones simuladas</span></div>
 <div class="kpi"><b>${S.filter(s => s.errores.length).length}</b><span>sesiones con error de JavaScript (${totErr} errores)</span></div>
 <div class="kpi"><b>${S.filter(s => s.atorados.length).length}</b><span>sesiones con algo atorado (${totAt})</span></div>
 <div class="kpi"><b>${totDes}</b><span>veces que algo se salió de la pantalla</span></div>
 <div class="kpi"><b>${tiemposRes["Carga inicial (todo)"].promedio ?? "—"} ms</b><span>carga promedio (p95 ${tiemposRes["Carga inicial (todo)"].p95 ?? "—"} ms)</span></div>
 <div class="kpi"><b>${premios.invalidos_aceptados_por_error}</b><span>códigos de premio falsos aceptados (debe ser 0)</span></div>
</div>

<h2>Lo más importante</h2>
${hallazgos.length ? `<div class="hall">${hallazgos.slice(0, 5).map((h, i) => `<article class="g-${esc(h.gravedad || "media")}"><h3>${i + 1}. ${esc(h.titulo)}<span class="etq">Gravedad ${esc(h.gravedad || "media")}</span></h3><dl><dt>Qué pasa</dt><dd>${esc(h.que)}</dd><dt>En qué celular</dt><dd>${esc(h.celular)}</dd><dt>Cómo reproducirlo</dt><dd>${esc(h.reproducir)}</dd><dt>Corrección propuesta</dt><dd>${esc(h.correccion)}</dd></dl></article>`).join("")}</div>` : `<p class="nota">Pendiente de revisar.</p>`}

<h2>¿Los sorteos son parejos?</h2>
<p class="nota">La barra es cuántas veces salió cada cosa; la rayita negra es cuántas veces debería salir si todo fuera justo (tomando en cuenta las reglas de la app: el drink del día no repite el que ya estaba, y la ruleta del Antro tiene pesos y no da shots seguidos en 15 minutos). Con menos de 5 resultados esperados por casilla, la prueba no alcanza para concluir.</p>
<div class="grid2">
${barras("Drink del día", est.pruebas["Drink del día (tragamonedas)"])}
${barras("Ruleta del Modo Antro", est.pruebas["Ruleta del Modo Antro"], tituloDe)}
${barras("Quiz «¿Qué drink eres?»", est.pruebas["Quiz «¿Qué drink eres?»"])}
${barras("Ruleta de ¿A ver qué te toca?", est.pruebas["Ruleta de ¿A ver qué te toca?"])}
${barras("El Dedo: posición del dedo elegido", est.pruebas["El Dedo (qué dedo gana)"])}
</div>
<p class="nota">${dedoFoco ? `El Dedo se midió con una prueba aparte de ${dedoFoco.length} rondas (2 a 6 dedos), identificando al ganador por la posición de su dedo; ${dedoFoco.filter(d => d.ganador < 0).length} rondas sin elegir a nadie. ` : ""}En la simulación general: ${dedoRondas} rondas con todos los dedos puestos (${dedoSinEleccion} sin elegir a nadie) · ${dedoQuito} rondas donde alguien quitó el dedo antes (${dedoQuitoEligio} de esas eligieron a alguien igual).</p>

<h2>La Peda: ¿a todos les tocan cartas parejo?</h2>
<p>${est.peda.partidas} partidas · ${est.peda.cartas_promedio ?? "—"} cartas en promedio · <b>${est.peda.con_alguien_sin_carta}</b> partidas donde alguien se quedó sin carta · <b>${est.peda.diferencia_max_min_mayor_a_1}</b> partidas donde la diferencia entre el que más y el que menos cartas tuvo fue de más de 1.</p><p>Ojo: en ${est.peda.partidas - est.peda.completas} partidas el simulador se saltó leer alguna carta (por los dobles toques), así que su conteo no es exacto. En las <b>${est.peda.completas}</b> partidas leídas completas, <b>${est.peda.completas_disparejas}</b> quedaron disparejas: la rotación da una carta a cada quien antes de repetir.</p>
<details><summary>Ver cada partida</summary>${tabla(["Sesión", "Jugadores", "Cartas", "Cartas leídas", "Diferencia más–menos", "Sin carta"], pedaJusta.map(x => [x.id, x.jugadores, x.cartas, x.leidas, x.maxmin, x.sinCarta]))}</details>

<h2>Errores y fallas</h2>
<div class="grid2">
${barrasSimples("Sesiones con error por celular", "porcentaje de sesiones con al menos un error de JavaScript", Object.entries(porCel).map(([k, v]) => [k, v.sesiones ? Math.round(v.con_error / v.sesiones * 100) : 0, `${k}: ${v.con_error} de ${v.sesiones} sesiones (${v.errores} errores, ${v.atorados} atorados, ${v.desbordes} desbordes)`]), v => v + "%")}
${barrasSimples("Problemas por sección", "errores + acciones atoradas", Object.entries(porSec).map(([k, v]) => [k, v.errores + v.atorados, `${k}: ${v.errores} errores, ${v.atorados} atorados en ${v.sesiones} visitas`]))}
</div>
${tabla(["Celular", "Sesiones", "Con error", "Errores", "Atorados", "Desbordes", "Tapados"], Object.entries(porCel).map(([k, v]) => [k, v.sesiones, pct(v.con_error, v.sesiones), v.errores, v.atorados, v.desbordes, v.tapados]))}
<h3>Errores más comunes</h3>${erroresTop.length ? tabla(["Qué", "Veces", "Ejemplo"], erroresTop.slice(0, 10).map(([k, v]) => [k, v.veces, `sesión ${v.ejemplo.sesion} · ${v.ejemplo.celular} · al «${v.ejemplo.accion}»`])) : `<p class="nota">Ningún error de JavaScript.</p>`}
<h3>Acciones atoradas (más de 10 s)</h3>${atoradosTop.length ? tabla(["Qué", "Veces", "Ejemplo"], atoradosTop.slice(0, 10).map(([k, v]) => [k, v.veces, `sesión ${v.ejemplo.sesion} · ${v.ejemplo.celular}`])) : `<p class="nota">Ninguna.</p>`}
<h3>Cosas que se salen de la pantalla o quedan tapadas</h3>${desbordesTop.length || tapadosTop.length ? tabla(["Qué", "Veces", "Ejemplo"], [...desbordesTop, ...tapadosTop].slice(0, 12).map(([k, v]) => [k, v.veces, `sesión ${v.ejemplo.sesion} · ${v.ejemplo.celular}`])) : `<p class="nota">Nada se salió de la pantalla ni quedó tapado.</p>`}

<h2>Tiempos</h2>
${tabla(["Qué", "Mediciones", "Promedio", "95% de las veces, menos de"], Object.entries(tiemposRes).map(([k, v]) => [k, v.n, v.promedio == null ? "—" : v.promedio + " ms", v.p95 == null ? "—" : v.p95 + " ms"]))}
<p class="nota">Medido en un servidor local; en la vida real la carga depende de la señal. Los giros incluyen la animación completa.</p>

<h2>¿Hasta dónde llega cada persona?</h2>
${tabla(["Perfil", "Paso", "Personas", "% del perfil"], Object.entries(embudos).flatMap(([p, e]) => Object.entries(e).filter(([k]) => k !== "sesiones").map(([k, v]) => [p, k, v, pct(v, e.sesiones)])))}
<div class="grid2" style="margin-top:14px">
${barrasSimples("Dónde terminaron", "última sección que vio cada persona", Object.entries(abandono).sort((a, b) => b[1] - a[1]))}
</div>
<details><summary>Recorridos más comunes</summary>${tabla(["Recorrido", "Personas"], rutas)}</details>

<h2>Botellas premiadas</h2>
<p>Códigos válidos probados: <b>${premios.validos_probados}</b> (aceptados ${premios.validos_aceptados}). Códigos falsos probados: <b>${premios.invalidos_probados}</b> · aceptados por error: <b>${premios.invalidos_aceptados_por_error}</b> · guardados en «Mis premios» por error: <b>${premios.invalidos_guardados_en_mis_premios}</b>.</p>
${tabla(["Tipo de código → qué mostró la app", "Veces"], premios.por_tipo)}

<h2>Cómo se hizo</h2>
<p class="nota">Playwright con Chromium sin ventana, emulando iPhone 13, iPhone SE, Pixel 7, Galaxy S8 y un Android de 360 px con pantalla táctil. Perfiles: 30% curiosa de drinks, 25% pre con amigos, 20% en el antro, 15% rápido, 10% botella premiada. Esperas de 0.3 a 3 s entre acciones; ~20% de las personas regresan con lo que guardaron antes. Cada acción tiene 10 s para responder. Los iPhone se emulan en Chromium (tamaño, pantalla y navegador simulados), así que fallas exclusivas de Safari no aparecen aquí. Para repetir: <code>npm run simular</code> y <code>npm run reporte</code> en la carpeta <code>pruebas</code>.</p>
</main><div id="tip" role="tooltip"></div>
<script>
const tip=document.getElementById("tip");
function ver(e){const f=e.target.closest("[data-tip]");if(!f){tip.style.opacity=0;return}tip.textContent=f.dataset.tip;const r=f.getBoundingClientRect();tip.style.left=Math.min(innerWidth-270,Math.max(8,(e.clientX||r.left)+12))+"px";tip.style.top=((e.clientY||r.top)+16)+"px";tip.style.opacity=1}
document.addEventListener("mousemove",ver);document.addEventListener("focusin",ver);document.addEventListener("mouseleave",()=>tip.style.opacity=0);
</script></body></html>`;
writeFileSync(join(SALIDA, "reporte.html"), page);
console.log("Listo: salida/resultados.csv, salida/estadisticas.json, salida/reporte.html");
