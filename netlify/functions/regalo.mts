// /api/regalo — el regalo de la casilla dorada del Modo Antro.
// POST crea el ticket (folio, fecha y hora del servidor). GET ?folio= dice si es válido
// y si ya se reclamó. POST ?folio=&accion=reclamar lo marca como entregado.
import type { Config, Context } from "@netlify/functions";
import { premios, huellaIP, excedeLimite, leerJSON, json, CORS, DAY } from "../lib/muro.mts";

const FOLIO_RE = /^PB-[A-Z0-9]{5}$/;
const ALFA = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const nuevoFolio = () => { const r = new Uint8Array(5); crypto.getRandomValues(r); return "PB-" + Array.from(r, (n) => ALFA[n % ALFA.length]).join(""); };
const DISP_RE = /^[a-z0-9]{6,40}$/;

export default async (req: Request, context: Context) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  const s = premios(), url = new URL(req.url);
  const folio = (url.searchParams.get("folio") || "").toUpperCase();

  if (req.method === "GET") {
    if (!FOLIO_RE.test(folio)) return json({ valido: false });
    const r = (await s.get(`regalo/${folio}`, { type: "json" })) as any;
    return json(r ? { valido: true, folio, ts: r.ts, tipo: r.tipo, reclamado: !!r.reclamado, reclamadoTs: r.reclamadoTs || null } : { valido: false });
  }

  if (req.method === "POST" && folio) {
    if (url.searchParams.get("accion") !== "reclamar" || !FOLIO_RE.test(folio)) return json({ error: "Petición inválida." }, 400);
    const r = (await s.get(`regalo/${folio}`, { type: "json" })) as any;
    if (!r) return json({ valido: false }, 404);
    if (!r.reclamado) { r.reclamado = true; r.reclamadoTs = Date.now(); await s.setJSON(`regalo/${folio}`, r); }
    return json({ valido: true, folio, reclamado: true, reclamadoTs: r.reclamadoTs });
  }

  if (req.method === "POST") {
    let body: any = {};
    try { body = await leerJSON(req, 2000); } catch { return json({ error: "Petición inválida." }, 400); }
    const disp = String(body.dispositivo || "");
    const tipo = body.tipo === "sinalcohol" ? "sinalcohol" : "shot";
    if (!DISP_RE.test(disp)) return json({ error: "Petición inválida." }, 400);
    // Un regalo por cel cada 12 h, y un tope por red (el Wi-Fi del lugar es compartido).
    const previo = (await s.get(`regalo-disp/${disp}`, { type: "json" })) as any;
    if (previo && Date.now() - previo.ts < DAY / 2) return json({ limitado: true, folio: previo.folio, ts: previo.ts });
    if (await excedeLimite("regalo-ip/" + (await huellaIP(context.ip)), 30, DAY / 2)) return json({ limitado: true }, 429);
    const f = nuevoFolio(), ts = Date.now();
    await s.setJSON(`regalo/${f}`, { ts, tipo, disp, reclamado: false });
    await s.setJSON(`regalo-disp/${disp}`, { ts, folio: f });
    return json({ valido: true, folio: f, ts, tipo }, 201);
  }
  return json({ error: "Método no permitido." }, 405);
};

export const config: Config = { path: "/api/regalo", method: ["GET", "POST", "OPTIONS"] };
