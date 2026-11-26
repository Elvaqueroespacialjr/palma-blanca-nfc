// /api/premio — botellas premiadas. GET verifica un código; POST (con PIN del staff) lo canjea.
// Código: PB-<BL|CV|DS>-<serie de 4 dígitos>-<firma de 4>. La firma solo la puede generar
// quien tiene PREMIO_SECRET, así que no se pueden inventar códigos.
import type { Config } from "@netlify/functions";
import { premios, firmaPremio, esStaff, mismoTexto, json, CORS } from "../lib/muro.mts";

const RE = /^PB-(BL|CV|DS)-(\d{4})-([A-Z0-9]{4})$/;

async function validar(raw: string) {
  const code = String(raw || "").trim().toUpperCase();
  const m = code.match(RE);
  if (!m) return null;
  const firma = await firmaPremio(m[1], m[2]);
  if (!firma || !mismoTexto(firma, m[3])) return null;
  return { code, tipo: m[1] };
}

export default async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  const url = new URL(req.url);
  const p = await validar(url.searchParams.get("code") || "");
  if (!p) return json({ valido: false });
  const s = premios(), k = `canje/${p.code}`;
  const previo = (await s.get(k, { type: "json" })) as { ts: number } | null;
  if (req.method === "GET") return json({ valido: true, tipo: p.tipo, canjeado: !!previo, canjeadoTs: previo?.ts || null });
  if (req.method === "POST") {
    if (!esStaff(req)) return json({ error: "PIN incorrecto." }, 403);
    if (previo) return json({ valido: true, canjeado: true, canjeadoTs: previo.ts, yaEstaba: true }, 409);
    const ts = Date.now();
    await s.setJSON(k, { ts });
    return json({ valido: true, canjeado: true, canjeadoTs: ts });
  }
  return json({ error: "Método no permitido." }, 405);
};

export const config: Config = { path: "/api/premio", method: ["GET", "POST", "OPTIONS"] };
