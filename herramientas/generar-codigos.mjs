// Genera códigos de botellas premiadas firmados (los mismos que acepta /api/premio).
// Uso: node herramientas/generar-codigos.mjs BL 1 50   → 50 códigos de barra libre (series 0001-0050)
// Tipos: BL = barra libre, CV = cover gratis, DS = 10% de descuento.
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
const ALFA = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const secreto = readFileSync(new URL("./.premio-secret", import.meta.url), "utf8").trim();
const [tipo = "BL", desde = "1", hasta = "50"] = process.argv.slice(2);
if (!["BL", "CV", "DS"].includes(tipo)) { console.error("Tipo: BL, CV o DS"); process.exit(1); }
const base = process.argv[5] || "https://palma-blanca-nfc.netlify.app/?premio=";
console.log("tipo,codigo,link_para_el_nfc");
for (let i = +desde; i <= +hasta; i++) {
  const serie = String(i).padStart(4, "0");
  const sig = createHmac("sha256", secreto).update(`${tipo}-${serie}`).digest();
  const firma = Array.from(sig.subarray(0, 4), (b) => ALFA[b % ALFA.length]).join("");
  const code = `PB-${tipo}-${serie}-${firma}`;
  console.log(`${tipo},${code},${base}${code}`);
}
