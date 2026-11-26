// Limpieza programada: borra del almacenamiento las fotos con más de 24 h.
// Corre cada 10 minutos (hora UTC; no depende de la hora local).
import type { Config } from "@netlify/functions";
import { borrarVencidas, limpiarContadores } from "../lib/muro.mts";

export default async () => {
  const n = await borrarVencidas();
  console.log(`Limpieza del muro: ${n} foto(s) vencida(s) borrada(s).`);
  if (new Date().getUTCMinutes() < 10) console.log(`Contadores y eventos viejos borrados: ${await limpiarContadores()}`);
};

export const config: Config = { schedule: "*/10 * * * *" };
