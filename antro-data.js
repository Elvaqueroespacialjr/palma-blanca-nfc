/* =====================================================================
   PALMA BLANCA · MODO ANTRO  —  Casillas de la ruleta
   ---------------------------------------------------------------------
   Aquí cambias lo que sale en la ruleta. No hace falta tocar nada más.

   Cada casilla:
     corto      Texto que se ve en la ruleta (corto, en MAYÚSCULAS).
     titulo     Título grande cuando sale.
     texto      Instrucción.
     color      oro | azul | papel | naranja | noche
     peso       Qué tan seguido sale comparado con las demás (1 = normal,
                2 = el doble, 0.5 = la mitad). El tamaño en la ruleta NO
                cambia: todas se dibujan iguales.
     segundos   (opcional) Cuenta regresiva en pantalla.
     fin        (opcional) Lo que aparece cuando termina la cuenta.
     tipo       (opcional) "foto" abre la cámara y sube la foto al muro.
     alcohol    true si implica tomar alcohol.
     puntos     Puntos que gana al hacerlo.
     sinAlcohol (opcional) Versión para quien activó "Hoy no tomo".

   Para que una casilla salga 2 veces en la ruleta, repítela (como
   "Shot en 5 segundos"). Cada copia necesita un id distinto.
   ===================================================================== */

window.ANTRO_DATA = {

  /* Minutos mínimos entre shots de la ruleta para la misma persona.
     Mientras tanto, la ruleta solo cae en casillas sin alcohol.      */
  minutosEntreShots: 15,

  /* ---------- Casilla dorada: REGALO ----------
     Un shot de Palma Blanca de regalo que se reclama con el mesero.
     La pantalla muestra la fecha, la hora y un folio para el mesero.
     probabilidad: 0.01 = sale 1 de cada 100 giros (en promedio).
     grados: qué tan delgada se ve en la ruleta (solo visual).        */
  ronda: {
    id: "regalo",
    probabilidad: 0.01,
    grados: 4,
    titulo: "¡Ganaste un shot de Palma Blanca!",
    texto: "Es un regalo. Reclámalo con tu mesero: enséñale esta pantalla.",
    alcohol: true,
    puntos: 50,
    sinAlcohol: { titulo: "¡Ganaste un drink sin alcohol!", texto: "Es un regalo. Reclámalo con tu mesero: enséñale esta pantalla." }
  },

  /* ---------- Casillas normales (en el orden de la ruleta) ---------- */
  casillas: [
    { id: "shot5a", corto: "SHOT 5S", titulo: "Shot en 5 segundos", texto: "Shot de Palma Blanca antes de que acabe la cuenta.",
      color: "oro", peso: 1, segundos: 5, fin: "¡SALUD!", alcohol: true, puntos: 10,
      sinAlcohol: { corto: "AGUA 5S", titulo: "Agua en 5 segundos", texto: "Un trago de agua antes de que acabe la cuenta.", fin: "¡LISTO!" } },

    { id: "vecinosa", corto: "SHOT VECINOS", titulo: "Shot con la mesa de al lado", texto: "Vayan a la mesa de al lado y tómense un shot de Palma Blanca con ellos.",
      color: "azul", peso: 1, alcohol: true, puntos: 20,
      sinAlcohol: { corto: "BRINDIS VECINOS", titulo: "Brindis con la mesa de al lado", texto: "Vayan a la mesa de al lado y brinden con ellos." } },

    { id: "senalen", corto: "SEÑALEN", titulo: "Señalen quién toma", texto: "A la cuenta de 3, todos señalan a alguien de la mesa. El más señalado toma.",
      color: "papel", peso: 1, segundos: 3, fin: "¡SEÑALEN!", alcohol: true, puntos: 10,
      sinAlcohol: { texto: "A la cuenta de 3, todos señalan a alguien de la mesa. El más señalado canta un coro." } },

    { id: "fotovecinos", corto: "FOTO VECINOS", titulo: "Foto con la mesa de al lado", texto: "Tómense una foto con la mesa de al lado. Se sube al muro de la noche.",
      color: "naranja", peso: 1, tipo: "foto", alcohol: false, puntos: 20 },

    { id: "fondo", corto: "FONDO", titulo: "¡Fondo!", texto: "Termínate tu drink de un jalón. Si es grande, con la mitad basta.",
      color: "noche", peso: 1, alcohol: true, puntos: 15,
      sinAlcohol: { corto: "FONDO AGUA", titulo: "Fondo de agua", texto: "Termínate tu vaso de agua de un jalón." } },

    { id: "shot3", corto: "SHOT 3S", titulo: "Shot en 3 segundos", texto: "Shot de Palma Blanca. Tienes 3 segundos.",
      color: "oro", peso: 1, segundos: 3, fin: "¡SALUD!", alcohol: true, puntos: 10,
      sinAlcohol: { corto: "AGUA 3S", titulo: "Agua en 3 segundos", texto: "Un trago de agua en 3 segundos.", fin: "¡LISTO!" } },

    { id: "reversazo", corto: "REVERSAZO", titulo: "¡Reversazo!", texto: "Te salvas: el reto le toca a quien giró la ruleta antes que tú.",
      color: "azul", peso: 1, alcohol: false, puntos: 15 },

    { id: "vecinosb", corto: "SHOT VECINOS", titulo: "Shot con la mesa de al lado", texto: "Vayan a la mesa de al lado y tómense un shot de Palma Blanca con ellos.",
      color: "naranja", peso: 1, alcohol: true, puntos: 20,
      sinAlcohol: { corto: "BRINDIS VECINOS", titulo: "Brindis con la mesa de al lado", texto: "Vayan a la mesa de al lado y brinden con ellos." } },

    { id: "shot5b", corto: "SHOT 5S", titulo: "Shot en 5 segundos", texto: "Shot de Palma Blanca antes de que acabe la cuenta.",
      color: "oro", peso: 1, segundos: 5, fin: "¡SALUD!", alcohol: true, puntos: 10,
      sinAlcohol: { corto: "AGUA 5S", titulo: "Agua en 5 segundos", texto: "Un trago de agua antes de que acabe la cuenta.", fin: "¡LISTO!" } },

    { id: "brindis", corto: "BRINDIS", titulo: "Brindis con toda la mesa", texto: "Todos arriba los vasos: brinden por esta noche. Con agua también vale.",
      color: "azul", peso: 1, alcohol: false, puntos: 10 },

    { id: "derecha", corto: "SHOT DERECHA", titulo: "Shot con el de tu derecha", texto: "Tú y la persona de tu derecha se toman un shot de Palma Blanca juntos.",
      color: "papel", peso: 1, alcohol: true, puntos: 15,
      sinAlcohol: { corto: "BRINDIS DERECHA", titulo: "Brindis con el de tu derecha", texto: "Brinda con la persona de tu derecha." } },

    { id: "mano", corto: "ÚLTIMA MANO", titulo: "Toma el último que levante la mano", texto: "A la cuenta de 3, todos levantan la mano. El último en levantarla toma.",
      color: "naranja", peso: 1, segundos: 3, fin: "¡MANOS ARRIBA!", alcohol: true, puntos: 10,
      sinAlcohol: { titulo: "El último que levante la mano", texto: "A la cuenta de 3, todos levantan la mano. El último en levantarla canta un coro." } }
  ]
};
