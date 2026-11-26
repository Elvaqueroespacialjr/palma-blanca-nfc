// /api/eventos — datos anónimos de uso (aperturas, giros, fotos, premios). Sin nombres ni teléfonos.
// POST guarda un lote. GET ?dias=7 con PIN del staff regresa el conteo por día y tipo.
import type { Config, Context } from "@netlify/functions";
import { eventos, esStaff, excedeLimite, huellaIP, json, CORS } from "../lib/muro.mts";

const PERMITIDOS = ["tipo", "detalle", "sobrio", "src", "device", "ts"];

export default async (req: Request, context: Context) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  const s = eventos();
  if (req.method === "POST") {
    const t = await req.text();
    if (!t || t.length > 50000) return json({ ok: false }, 400);
    if (await excedeLimite("ev/" + (await huellaIP(context.ip)), 600, 60 * 60 * 1000)) return json({ ok: false }, 429);
    let lote: any[] = [];
    try { lote = JSON.parse(t); } catch { return json({ ok: false }, 400); }
    if (!Array.isArray(lote)) return json({ ok: false }, 400);
    const limpio = lote.slice(0, 200).map((e) => Object.fromEntries(PERMITIDOS.filter((k) => k in (e || {})).map((k) => [k, String(e[k]).slice(0, 120)])));
    const dia = new Date().toISOString().slice(0, 10);
    await s.setJSON(`ev/${dia}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}`, limpio);
    return json({ ok: true });
  }
  if (req.method === "GET") {
    if (!esStaff(req)) return json({ error: "PIN incorrecto." }, 403);
    const dias = Math.min(31, Math.max(1, Number(new URL(req.url).searchParams.get("dias")) || 7));
    const out: Record<string, Record<string, number>> = {};
    for (let i = 0; i < dias; i++) {
      const dia = new Date(Date.now() - i * 864e5).toISOString().slice(0, 10);
      const { blobs } = await s.list({ prefix: `ev/${dia}/` });
      const lotes = await Promise.all(blobs.map((b) => s.get(b.key, { type: "json" })));
      const c: Record<string, number> = {};
      lotes.forEach((l: any) => (Array.isArray(l) ? l : []).forEach((e: any) => {
        c[e.tipo] = (c[e.tipo] || 0) + 1;
        // Certificados de bartender: también por drink ("certificado:Palmita")
        if (e.tipo === "certificado" && e.detalle) { const k = "certificado:" + String(e.detalle).slice(0, 40); c[k] = (c[k] || 0) + 1; }
      }));
      out[dia] = c;
    }
    return json({ dias: out });
  }
  return json({ error: "Método no permitido." }, 405);
};

export const config: Config = { path: "/api/eventos", method: ["GET", "POST", "OPTIONS"] };
