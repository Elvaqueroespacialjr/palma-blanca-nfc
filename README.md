# Palma Blanca NFC

App web de Tequila Palma Blanca que se abre desde el NFC de las botellas.
En vivo: https://palma-blanca-nfc.netlify.app

## Secciones
- **Drinks**: recetas, drink del día, quiz «¿Qué drink eres?», certificados de bartender y «Mis logros».
- **La Peda**: juego de cartas (Pre, Peda, After, Mixta, Cupido en la Mesa y Cita a Ciegas).
- **Modo Antro**: selfie, ruleta, retos, muro de fotos (se borran a las 24 h) y premios.
- **¿A ver qué te toca?**: ruleta de 7 juegos de mesa.
- Estadísticas para el staff: `#estadisticas` (pide el PIN del staff).

## Dónde se edita cada cosa
| Qué | Archivo |
|---|---|
| Recetas, quiz, estilos y casi toda la app | `public/index.html` |
| Cartas de La Peda | `public/lapeda-data.js` |
| Cartas de Cita a Ciegas / Cupido | `public/blinddate-data.js` |
| Juegos de «¿A ver qué te toca?» | `public/juegos-data.js` |
| Casillas de la ruleta del Modo Antro | `public/antro-data.js` |
| Aviso de privacidad, términos y bases de la rifa | `public/privacidad-data.js` |
| Fotos y logos | `public/img/` (el nombre lleva una huella; si cambias una foto, cámbiale el nombre) |
| Funciones del servidor (muro, premios, estadísticas) | `netlify/functions/` |

## Secretos (NO van en este repositorio)
En Netlify → Project configuration → Environment variables:
- `STAFF_PIN`: PIN del staff (cámbialo antes de cada evento).
- `PREMIO_SECRET`: firma de los códigos de botellas premiadas. Si cambia, los códigos ya impresos dejan de valer.

Para generar códigos de botellas premiadas: copia el secreto a `herramientas/.premio-secret` (está ignorado por git) y corre `node herramientas/generar-codigos.mjs`.

## Funciona sin señal
`public/sw.js` guarda la app, las fotos y las fuentes en el cel la primera vez que se abre. El muro, los premios y las estadísticas siempre necesitan internet; los datos de uso esperan guardados y se mandan cuando vuelve la señal.

**Antes de publicar cambios**, corre `node herramientas/actualizar-sw.mjs` para que la lista de archivos y la versión del `sw.js` se actualicen (si no, los celulares siguen usando la copia anterior hasta que vuelvan a tener señal).

## Publicar
Netlify publica la carpeta `public/` y las funciones de `netlify/functions/` (ver `netlify.toml`).
