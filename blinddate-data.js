/* =====================================================================
   LA PEDA · BLIND DATE  —  Cartas del modo
   ---------------------------------------------------------------------
   Aquí están todos los textos de Blind Date. Para agregar una carta,
   copia una línea, cámbiale el texto y deja la coma al final.

   - Las cartas normales salen por niveles, en el orden de abajo. Dentro
     de cada nivel salen al azar y no se repiten.
   - En cualquier texto puedes escribir {amiga}: se cambia por
     "Ana, la amiga que los juntó" (con el nombre que registraron) o,
     si no lo registraron, por "la amiga que los juntó".
   - Si una carta dice "toma", "tomas" o "toman", la app muestra el
     botón "Tomaron" para llevar la cuenta.
   - Si tu texto lleva comillas, usa ‘ ’ o « » en lugar de "".
   ===================================================================== */

window.BLINDDATE_DATA = {

  /* ---------- Ritmo de las cartas especiales ---------- */
  ritmo: {
    cartaDeAmorCada: [8, 10],   // una Carta de Amor cada 8 a 10 cartas
    probabilidadCupido: 0.12,   // de vez en cuando (12 % de las veces)
    probabilidadBrindis: 0.10   // de vez en cuando (10 % de las veces)
  },

  /* ---------- Cartas normales, por nivel ---------- */
  niveles: [
    {
      nombre: "Romper el hielo",
      cartas: [
        "Adivina a qué se dedica o qué estudia tu date. Si fallas, tomas.",
        "Adivina el signo zodiacal de tu date. Si fallas, tomas.",
        "¿Cuál fue tu primera impresión de tu date? Sé honesto.",
        "¿Qué te dijeron de tu date antes de conocerlo?",
        "Adivina su canción favorita. Si le atinas, toma tu date.",
        "¿Playa o montaña? Contesten al mismo tiempo. Si no coinciden, los dos toman.",
        "¿Café, té o chocolate? Adivina lo que diría tu date.",
        "¿Cuál es tu plan perfecto de domingo?",
        "¿Perro o gato? Si no coinciden, brindan por la diferencia.",
        "¿Qué es lo primero que te fijas en una persona?"
      ]
    },
    {
      nombre: "Conocerse",
      cartas: [
        "¿Qué es algo que te hace muy feliz y casi nadie sabe?",
        "¿Cuál es tu recuerdo favorito de cuando eras niño?",
        "¿Qué quieres estar haciendo en 5 años?",
        "¿Cuál es la persona que más admiras y por qué?",
        "¿Qué es lo más importante para ti en una relación?",
        "¿Cuál es la tradición familiar que más disfrutas?",
        "¿Qué es lo que más valoras de tus amigos?",
        "Si pudieras viajar mañana a cualquier lugar, ¿a dónde y con quién?",
        "¿Qué te enseñaron tus papás que nunca se te va a olvidar?",
        "¿Cuál ha sido el momento del que te sientes más orgulloso?",
        "¿Qué te ayuda cuando tienes un mal día?",
        "¿Cuál es tu sueño más grande?"
      ]
    },
    {
      nombre: "Coqueto ligero",
      cartas: [
        "Dile a tu date algo que te haya gustado de él o ella hoy.",
        "¿Cómo sería tu cita ideal?",
        "¿Qué detalle te conquista más: flores, una carta o una canción?",
        "Hazle un cumplido a tu date sin hablar de su físico.",
        "¿Crees en el amor a primera vista?",
        "Pon la canción que te gustaría dedicarle a tu date.",
        "¿Qué es lo más romántico que alguien ha hecho por ti?",
        "Del 1 al 10, ¿qué tan nervioso llegaste hoy?",
        "¿Qué tendría que pasar para que hubiera una segunda cita?",
        "Véanse a los ojos 15 segundos. El primero que se ría, toma.",
        "Mírense a los ojos 30 segundos. El primero que se ría se toma un shot.",
        "Tómense de la mano durante una ronda.",
        "Dile «amor» a tu pareja durante una ronda. Si se te olvida, tomas."
      ]
    },
    {
      nombre: "Retos en pareja",
      cartas: [
        "Tómense una foto juntos, la más seria posible.",
        "Brinden con los brazos entrelazados.",
        "Si ya tienen nombre de pareja, cuéntenle al grupo por qué lo eligieron. Si no, invéntenlo ahorita.",
        "Tu date te enseña un paso de baile y lo hacen juntos.",
        "Digan 3 cosas que tengan en común en 20 segundos. Si no llegan, los dos toman.",
        "Escríbanse un piropo en una servilleta y léanlo en voz alta.",
        "Hagan juntos un brindis por {amiga}.",
        "Cuéntenle al grupo cómo se «conocieron» pero en versión telenovela.",
        "Tú y tu pareja digan una palabra al mismo tiempo. Si no coinciden, los dos toman.",
        "Tómate una selfie con tu pareja.",
        "Intercambia una prenda o accesorio con tu pareja: gorra, chamarra o lentes.",
        "Tu pareja elige tu castigo.",
        "Cambia de pareja por una ronda.",
        "Pregunta incómoda: el grupo le hace una pregunta incómoda a la pareja. Si no contestan, toman.",
        "Todos te hacen una pregunta y solo puedes contestar una. Por cada una que no contestes, tomas.",
        "Verdad o reto: tu pareja elige.",
        "Las chicas toman.",
        "Los chicos toman.",
        "Regla: inventa una regla. Quien no la obedezca, toma."
      ]
    }
  ],

  /* ---------- Carta de Amor: contestan al mismo tiempo tras 3-2-1 ---------- */
  cartasDeAmor: [
    "¿Playa o montaña?",
    "¿Perro o gato?",
    "¿Dulce o salado?",
    "¿Cine o concierto?",
    "¿Madrugar o desvelarse?",
    "¿Viaje a Europa o a la playa?",
    "¿Comida mexicana o italiana?",
    "¿Plan en casa o salir?",
    "¿Mensaje o llamada?",
    "¿Flores o una carta?"
  ],

  /* ---------- Cupido: preguntas para la amiga que trajo al date ---------- */
  cupido: [
    "¿Por qué elegiste a esta persona para tu amiga?",
    "¿Qué tienen en común según tú?",
    "Del 1 al 10, ¿qué tan bien escogiste?",
    "Dales un consejo para su segunda cita."
  ],

  /* ---------- Brindis Palma: "Brinden con Palma Blanca por…" ---------- */
  brindis: [
    "el destino que los sentó en la misma mesa",
    "{amiga}",
    "su primera cita",
    "que haya segunda"
  ],

  /* ---------- Carta final (siempre es la última) ---------- */
  final: "¿Habrá segunda cita? Contesten al mismo tiempo: 3, 2, 1…"
};
