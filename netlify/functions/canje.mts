// /api/canje — premios del Modo Antro (gomitas y drink). El PIN del staff se revisa aquí,
// en el servidor, y cada cel solo puede canjear cada premio una vez.
import type { Config } from "@netlify/functions";
import { premios, esStaff, leerJSON, json, CORS } from "../lib/muro.mts";

const TIPOS = new Set(["gomitas", "drink"]);
const DISP_RE = /^[a-z0-9]{6,40}$/;

export default async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return json({ error: "Método no permitido." }, 405);
  let b: any = {};
  try { b = await leerJSON(req, 2000); } catch { return json({ error: "Petición inválida." }, 400); }
  if (!TIPOS.has(b.tipo) || !DISP_RE.test(String(b.dispositivo || ""))) return json({ error: "Petición inválida." }, 400);
  if (!esStaff(req)) return json({ error: "PIN incorrecto." }, 403);
  const s = premios(), k = `canje-antro/${b.dispositivo}/${b.tipo}`;
  const previo = (await s.get(k, { type: "json" })) as { ts: number } | null;
  if (previo) return json({ ok: false, yaEstaba: true, ts: previo.ts }, 409);
  const ts = Date.now();
  await s.setJSON(k, { ts });
  return json({ ok: true, ts });
};

export const config: Config = { path: "/api/canje", method: ["POST", "OPTIONS"] };
