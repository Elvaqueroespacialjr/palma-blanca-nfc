// ¿Cuántos regalos puede sacar una misma persona? Se prueba contra el servidor de PRUEBA (nunca producción).
// Uso: BASE_URL=http://localhost:8899 node regalo-abuso.mjs
import { writeFileSync, mkdirSync } from "node:fs";
const BASE = process.env.BASE_URL || "http://localhost:8888";
if (!/localhost|127\.0\.0\.1/.test(BASE)) { console.error("Solo contra un servidor local de prueba."); process.exit(1); }
const disp = () => Array.from({ length: 16 }, () => "abcdefghijklmnopqrstuvwxyz0123456789"[Math.floor(Math.random() * 36)]).join("");
const pedir = async d => { const r = await fetch(BASE + "/api/regalo", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ dispositivo: d, tipo: "shot" }) }); return { status: r.status, ...(await r.json().catch(() => ({}))) }; };
const R = {};
// 1) Misma persona, mismo cel, recargando la página (el cel conserva su identificador): 10 intentos
const yo = disp(); const a = []; for (let i = 0; i < 10; i++) a.push(await pedir(yo));
R.mismo_cel_10_intentos = { tickets_nuevos: a.filter(x => x.status === 201).length, limitado: a.filter(x => x.limitado).length };
// 2) Borrando los datos del navegador o en modo incógnito (identificador nuevo cada vez), misma red: 40 intentos
const b = []; for (let i = 0; i < 40; i++) b.push(await pedir(disp()));
R.datos_borrados_40_intentos = { tickets_nuevos: b.filter(x => x.status === 201).length, bloqueados_por_red: b.filter(x => x.status === 429).length, primer_bloqueo_en: b.findIndex(x => x.status === 429) + 1 };
// 3) ¿Se puede pedir el ticket sin haber girado la ruleta? (las pruebas 1 y 2 lo hicieron directo, sin girar)
R.sin_girar_la_ruleta = R.mismo_cel_10_intentos.tickets_nuevos + R.datos_borrados_40_intentos.tickets_nuevos > 0;
// 4) ¿Se puede marcar un ticket como entregado sin el PIN del staff?
const t = a.find(x => x.folio && x.status === 201) || b.find(x => x.folio && x.status === 201);
if (t) {
  const r = await fetch(BASE + `/api/regalo?folio=${t.folio}&accion=reclamar`, { method: "POST" }); const j = await r.json();
  R.marcar_entregado_sin_pin = { status: r.status, quedo_reclamado: !!j.reclamado };
}
mkdirSync(new URL("./salida/", import.meta.url), { recursive: true });
writeFileSync(new URL("./salida/regalo-abuso.json", import.meta.url), JSON.stringify(R, null, 1));
console.log(JSON.stringify(R, null, 1));
