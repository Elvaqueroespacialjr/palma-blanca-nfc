// Escribe en public/sw.js la lista de archivos que se guardan en el cel y una versión nueva.
// Córrelo antes de publicar cada vez que cambies la app:  node herramientas/actualizar-sw.mjs
import { readdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const pub = fileURLToPath(new URL("../public/", import.meta.url));
const omitir = new Set(["sw.js"]);
const lista = [];
(function recorrer(dir) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) recorrer(p);
    else if (!omitir.has(n) && !n.startsWith(".")) lista.push(relative(pub, p).split("\\").join("/"));
  }
})(pub);
lista.sort();

const ahora = new Date(), version = ahora.toISOString().slice(0, 16).replace(/[-:T]/g, "");
const swPath = join(pub, "sw.js");
let sw = readFileSync(swPath, "utf8");
sw = sw.replace(/const VERSION = "[^"]*"; \/\/ AUTO-VERSION/, `const VERSION = "${version}"; // AUTO-VERSION`);
sw = sw.replace(/const ARCHIVOS = \/\* AUTO-LISTA \*\/ \[[^\]]*\];/, `const ARCHIVOS = /* AUTO-LISTA */ ${JSON.stringify(lista)};`);
writeFileSync(swPath, sw);
console.log(`sw.js actualizado: versión ${version}, ${lista.length} archivos.`);
