// /api/foto/:id — sirve la imagen de una foto del muro mientras siga viva.
import type { Config, Context } from "@netlify/functions";
import { DAY, PREFIX, ID_RE, muro, tsDe, CORS } from "../lib/muro.mts";

export default async (req: Request, context: Context) => {
  const id = context.params.id || "";
  if (!ID_RE.test(id)) return new Response("No encontrada", { status: 404 });
  const s = muro();
  const restante = tsDe(id) + DAY - Date.now();
  if (restante <= 0) {
    context.waitUntil(s.delete(PREFIX + id));
    return new Response("Esta foto ya se borró", { status: 404, headers: { "cache-control": "no-store" } });
  }
  const data = await s.get(PREFIX + id, { type: "arrayBuffer" });
  if (data === null) return new Response("No encontrada", { status: 404, headers: { "cache-control": "no-store" } });
  // Caché solo en el cel de quien la ve (nunca en la CDN) y nunca más allá de su vida.
  const maxAge = Math.max(0, Math.min(600, Math.floor(restante / 1000)));
  return new Response(data, {
    headers: {
      "content-type": "image/jpeg",
      "cache-control": `private, max-age=${maxAge}`,
      "netlify-cdn-cache-control": "no-store",
      "x-content-type-options": "nosniff",
      ...CORS,
    },
  });
};

export const config: Config = { path: "/api/foto/:id", method: "GET" };
