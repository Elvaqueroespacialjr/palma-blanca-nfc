// Utilidades compartidas del muro (no es una función: lo importan las demás).
import { getStore } from "@netlify/blobs";

export const DAY = 24 * 60 * 60 * 1000;
export const PREFIX = "f/";
export const ID_RE = /^\d{12,14}-[a-f0-9]{12}$/;

// Consistencia fuerte: un borrado se nota de inmediato en todo el mundo.
export const muro = () => getStore({ name: "muro-fotos", consistency: "strong" });

export const tsDe = (id: string) => Number(id.split("-")[0]) || 0;

export async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function mismoTexto(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

// CORS: la app también se abre desde el link de claude.ai (otro dominio). No usamos cookies;
// borrar exige la llave de la foto o el PIN del staff, así que abrir el origen es seguro.
export const CORS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, DELETE, OPTIONS",
  "access-control-allow-headers": "content-type, x-token, x-nick, x-tipo, x-staff-pin, x-device",
  "access-control-max-age": "86400",
};

export const json = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: { "cache-control": "no-store", ...CORS } });

/** Borra de verdad todas las fotos con más de 24 h. Regresa cuántas borró. */
export async function borrarVencidas(): Promise<number> {
  const s = muro();
  const { blobs } = await s.list({ prefix: PREFIX });
  const now = Date.now();
  const viejas = blobs.filter((b) => now - tsDe(b.key.slice(PREFIX.length)) >= DAY);
  await Promise.all(viejas.map((b) => s.delete(b.key)));
  return viejas.length;
}

/* ---------- Utilidades para premios, regalos, canjes y eventos ---------- */
export const premios = () => getStore({ name: "premios", consistency: "strong" });
export const eventos = () => getStore({ name: "eventos" });

/** PIN del staff (variable STAFF_PIN en Netlify), comparado en el servidor. */
export function esStaff(req: Request): boolean {
  const pin = Netlify.env.get("STAFF_PIN") || "";
  const dado = req.headers.get("x-staff-pin") || "";
  return pin.length >= 8 && dado.length > 0 && mismoTexto(dado, pin);
}

/** Huella de la IP (nunca se guarda la IP tal cual). */
export async function huellaIP(ip: string | undefined): Promise<string> {
  return (await sha256("pb:" + (ip || "sin-ip"))).slice(0, 24);
}

/** Firma de los códigos de botella premiada: PB-<TIPO>-<SERIE>-<FIRMA>. */
const ALFA = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export async function firmaPremio(tipo: string, serie: string): Promise<string> {
  const secreto = Netlify.env.get("PREMIO_SECRET") || "";
  if (secreto.length < 16) return "";
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secreto), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${tipo}-${serie}`)));
  return Array.from(sig.slice(0, 4), (b) => ALFA[b % ALFA.length]).join("");
}

/** Límite simple por ventana de tiempo (cuenta aproximada, suficiente contra abusos). */
export async function excedeLimite(clave: string, max: number, ventanaMs: number): Promise<boolean> {
  const s = premios();
  const k = `lim/${new Date().toISOString().slice(0, 10)}/${clave}/${Math.floor(Date.now() / ventanaMs)}`;
  const v = (await s.get(k, { type: "json" })) as { n: number } | null;
  const n = (v?.n || 0) + 1;
  if (n > max) return true;
  await s.setJSON(k, { n });
  return false;
}

export const leerJSON = async (req: Request, max = 20000): Promise<any> => {
  const t = await req.text();
  if (t.length > max) throw new Error("grande");
  return t ? JSON.parse(t) : {};
};

/** Limpieza de contadores viejos (más de 2 días) y eventos de más de 90 días. */
export async function limpiarContadores(): Promise<number> {
  let n = 0;
  const hoy = Date.now();
  const p = premios(), { blobs } = await p.list({ prefix: "lim/" });
  const viejosLim = blobs.filter((b) => hoy - Date.parse(b.key.slice(4, 14)) > 2 * DAY);
  await Promise.all(viejosLim.map((b) => p.delete(b.key))); n += viejosLim.length;
  const e = eventos(), ev = await e.list({ prefix: "ev/" });
  const viejosEv = ev.blobs.filter((b) => hoy - Date.parse(b.key.slice(3, 13)) > 90 * DAY);
  await Promise.all(viejosEv.map((b) => e.delete(b.key))); n += viejosEv.length;
  return n;
}
