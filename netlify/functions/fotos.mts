// /api/fotos — lista (GET), sube (POST) y borra (DELETE) fotos del muro.
import type { Config, Context } from "@netlify/functions";
import { DAY, PREFIX, ID_RE, muro, tsDe, sha256, mismoTexto, json, CORS, huellaIP, excedeLimite } from "../lib/muro.mts";

const MAX_BYTES = 3_500_000; // una foto con marco pesa ~0.3–0.6 MB
const MAX_LISTA = 150;
const TIPOS = new Set(["selfie", "ruleta", "muro"]);

function esStaff(req: Request): boolean {
  const pin = Netlify.env.get("STAFF_PIN") || "";
  const dado = req.headers.get("x-staff-pin") || "";
  return pin.length >= 8 && dado.length > 0 && mismoTexto(dado, pin);
}

export default async (req: Request, context: Context) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  const s = muro();
  const url = new URL(req.url);

  if (req.method === "GET") {
    if (url.searchParams.has("staff")) return json({ staff: esStaff(req) });
    const now = Date.now();
    const { blobs } = await s.list({ prefix: PREFIX });
    const vivas: string[] = [];
    const vencidas: string[] = [];
    for (const b of blobs) {
      const id = b.key.slice(PREFIX.length);
      if (!ID_RE.test(id)) continue;
      (now - tsDe(id) >= DAY ? vencidas : vivas).push(id);
    }
    // Lo vencido se borra de verdad aquí mismo, sin esperar a la limpieza programada.
    if (vencidas.length) context.waitUntil(Promise.all(vencidas.map((id) => s.delete(PREFIX + id))));
    vivas.sort((a, b) => tsDe(b) - tsDe(a));
    const ids = vivas.slice(0, MAX_LISTA);
    const metas = await Promise.all(ids.map((id) => s.getMetadata(PREFIX + id)));
    const fotos = ids.flatMap((id, i) => {
      const m = metas[i];
      if (!m) return [];
      const md = (m.metadata || {}) as Record<string, string>;
      const ts = tsDe(id);
      return [{ id, nick: md.nick || "Anónimo", tipo: md.tipo || "muro", ts, exp: ts + DAY, url: `/api/foto/${id}` }];
    });
    return json({ fotos, now });
  }

  if (req.method === "POST") {
    if (!(req.headers.get("content-type") || "").startsWith("image/jpeg")) return json({ error: "Solo fotos JPG." }, 415);
    // Límite contra abusos: 10 fotos por hora por cel y 120 por hora por red (el Wi-Fi del lugar es compartido).
    const disp = (req.headers.get("x-device") || "").replace(/[^a-z0-9]/g, "").slice(0, 40) || "sin-disp";
    if (await excedeLimite("muro-disp/" + disp, 10, 3600000) || await excedeLimite("muro-ip/" + (await huellaIP(context.ip)), 120, 3600000)) {
      return json({ error: "Subiste muchas fotos seguidas. Espera un rato." }, 429);
    }
    const token = req.headers.get("x-token") || "";
    if (!/^[a-f0-9]{32,128}$/.test(token)) return json({ error: "Falta la llave de borrado." }, 400);
    const buf = await req.arrayBuffer();
    if (!buf.byteLength || buf.byteLength > MAX_BYTES) return json({ error: "La foto pesa demasiado." }, 413);
    const head = new Uint8Array(buf, 0, 3);
    if (head[0] !== 0xff || head[1] !== 0xd8 || head[2] !== 0xff) return json({ error: "Solo fotos JPG." }, 415);
    let nick = "";
    try { nick = decodeURIComponent(req.headers.get("x-nick") || ""); } catch { nick = ""; }
    nick = nick.replace(/[\u0000-\u001f\u007f<>]/g, "").replace(/\s+/g, " ").trim().slice(0, 15) || "Anónimo";
    const tipoDado = req.headers.get("x-tipo") || "";
    const tipo = TIPOS.has(tipoDado) ? tipoDado : "muro";
    const ts = Date.now();
    const id = `${ts}-${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
    // Solo guardamos el hash de la llave: ni el servidor puede usarla para borrar.
    await s.set(PREFIX + id, buf, { metadata: { nick, tipo, th: await sha256(token) } });
    return json({ id, ts, exp: ts + DAY, url: `/api/foto/${id}` }, 201);
  }

  if (req.method === "DELETE") {
    const id = url.searchParams.get("id") || "";
    if (!ID_RE.test(id)) return json({ error: "Foto inválida." }, 400);
    const meta = await s.getMetadata(PREFIX + id);
    if (!meta) return json({ ok: true });
    const th = String((meta.metadata as Record<string, string>)?.th || "");
    const token = req.headers.get("x-token") || "";
    const esDueno = token.length > 0 && th.length > 0 && mismoTexto(await sha256(token), th);
    if (!esDueno && !esStaff(req)) return json({ error: "Esta foto no es tuya." }, 403);
    await s.delete(PREFIX + id);
    return json({ ok: true });
  }

  return json({ error: "Método no permitido." }, 405);
};

export const config: Config = {
  path: "/api/fotos",
  method: ["GET", "POST", "DELETE", "OPTIONS"],
};
