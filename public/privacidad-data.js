/* =====================================================================
   PALMA BLANCA NFC · Textos legales: Aviso de privacidad y Términos
   ---------------------------------------------------------------------
   ⚠️ ANTES DE USAR EN UN EVENTO, LLENA ESTOS DATOS Y PIDE A TU ÁREA
   LEGAL QUE REVISE LOS TEXTOS (esto es una base, no asesoría legal):
     - responsable: razón social exacta de la empresa
     - domicilio:   domicilio fiscal o para oír notificaciones
     - contacto:    correo para privacidad y dudas de la rifa
     - permisoRifa: número de permiso de Gobernación (SEGOB) si aplica
   Si un dato está vacío, la app lo reemplaza por una frase genérica.
   ===================================================================== */

window.LEGAL = {
  responsable: "Tequila Palma Blanca",   // ← razón social (ej. "Tequila Palma Blanca, S.A. de C.V.")
  domicilio: "",                          // ← domicilio completo
  contacto: "",                           // ← correo real (ej. privacidad@tequilapalmablanca.com)
  sitio: "tequilapalmablanca.com",
  instagram: "@palma_blanca_tequila",
  permisoRifa: ""                         // ← número de permiso SEGOB de la rifa, si lo tienen
};

window.PRIVACIDAD = {
  titulo: "Aviso de privacidad",
  actualizado: "26 de noviembre de 2026",
  secciones: [
    { t: "Quién es responsable de tus datos",
      p: ["{responsable}, con domicilio en {domicilio}, es responsable del uso y protección de los datos que se generan al usar esta app, conforme a la legislación mexicana de protección de datos personales."] },
    { t: "Qué datos usamos",
      p: [
        "Fotos del muro: solo las fotos que tú decides subir en el Modo Antro, con su marco, fecha y hora. Se publican en el muro del evento y se borran solas 24 horas después. Puedes borrar las tuyas antes.",
        "Nombre o apodo del certificado de bartender: se guarda solo en tu cel y solo aparece en la imagen que tú decides compartir.",
        "Datos anónimos de uso: qué secciones abres, giros, juegos, certificados y premios canjeados, con un identificador al azar de tu navegador. No pedimos tu teléfono, correo ni ubicación.",
        "Datos que se quedan en tu cel: nombres de jugadores, favoritos, tu drink del día, recetas preparadas, logros y premios. No salen de tu cel, salvo el código de un premio cuando el staff lo verifica.",
        "Cámara: solo se usa cuando tú la abres para tomar una foto. No grabamos audio ni video.",
        "No pedimos datos sensibles (salud, religión, origen, etc.)."
      ] },
    { t: "Para qué los usamos",
      p: [
        "Finalidades necesarias: que funcionen los juegos, el muro y los certificados; validar premios y regalos; evitar abusos (por ejemplo, demasiadas fotos desde un mismo cel).",
        "Finalidad adicional: hacer estadísticas generales para mejorar la app y los eventos. Si no quieres que tus datos anónimos se usen para esto, escríbenos a {contacto}.",
        "No vendemos tus datos ni los usamos para publicidad de terceros."
      ] },
    { t: "Con quién se comparten",
      p: ["Los datos se guardan en los servidores de nuestro proveedor de hosting (Netlify, que puede almacenarlos fuera de México), que actúa solo por nuestra cuenta. No los transferimos a terceros, salvo cuando una autoridad lo pida conforme a la ley."] },
    { t: "Almacenamiento en tu navegador",
      p: ["La app usa el almacenamiento local de tu navegador (no cookies de publicidad) para recordar tus preferencias y tu identificador anónimo. Puedes borrarlo en cualquier momento desde los ajustes de tu navegador."] },
    { t: "Tus derechos (ARCO) y cómo retirar tu consentimiento",
      p: ["Puedes pedir acceso, rectificación, cancelación u oposición al uso de tus datos, retirar tu consentimiento o pedir que borremos una foto escribiendo a {contacto}. Indica qué pides y, si es una foto, la fecha y hora aproximadas. Te responderemos en un máximo de 20 días hábiles."] },
    { t: "Solo mayores de edad",
      p: ["Esta app es solo para mayores de 18 años. Si nos enteramos de que un menor subió una foto, la borramos."] },
    { t: "Cambios a este aviso",
      p: ["Si cambiamos este aviso, lo publicaremos en esta misma app con su nueva fecha de actualización."] }
  ]
};

window.TERMINOS = {
  titulo: "Términos y condiciones",
  actualizado: "26 de noviembre de 2026",
  secciones: [
    { t: "Uso de la app",
      p: ["Esta app de {responsable} ofrece recetas, juegos y dinámicas para eventos. Al usarla aceptas estos términos. Es gratuita y su uso es voluntario."] },
    { t: "Solo mayores de 18 años y consumo responsable",
      p: [
        "La app y sus contenidos son exclusivamente para mayores de 18 años.",
        "Todos los juegos y retos son voluntarios. En cualquier carta o reto puedes decir «Paso» y nadie está obligado a tomar. También puedes jugar con la opción sin alcohol.",
        "Evita el exceso. Si tomas, no manejes. No participes si estás embarazada, tomando medicamentos o si no te sientes bien."
      ] },
    { t: "Botellas premiadas",
      p: ["Cada código de botella premiada es de un solo uso, personal e intransferible, y se valida en el servidor. El premio se entrega en el evento indicado, sujeto a disponibilidad, y no se puede cambiar por dinero. Un código alterado, copiado o ya canjeado no es válido."] },
    { t: "Regalo de la ruleta del Modo Antro",
      p: ["El shot de regalo es solo para mayores de 18 años, se reclama al mesero el mismo día y en el mismo lugar, y no se puede cambiar por dinero. El staff puede no entregarlo si la persona no está en condiciones de seguir tomando, o pedir identificación."] },
    { t: "Muro de fotos",
      p: ["Solo sube fotos en las que tú y quienes salen estén de acuerdo. No se permiten fotos de menores, desnudos, violencia, ni contenido ofensivo o que dañe a alguien. El staff puede borrar cualquier foto. Todas se borran solas 24 horas después."] },
    { t: "Certificados y logros",
      p: ["Los certificados de bartender y los logros son recreativos: reconocen las recetas que preparaste, no la cantidad que tomas. No tienen valor monetario."] },
    { id: "rifa", t: "Bases de la rifa de cover",
      p: [
        "Organiza: {responsable}. {permiso}",
        "Quién participa: personas mayores de 18 años que residan en México, con perfil de Instagram público.",
        "Cómo participar: durante el evento de Palma Blanca y hasta las 23:59 de ese día, publica en tu historia de Instagram tu certificado o tu drink de la app etiquetando a {instagram}. Una participación por persona por evento.",
        "Premio: un cover gratis (entrada sin costo) para el siguiente evento de Palma Blanca. Hay un ganador por evento. El premio es personal e intransferible y no se puede cambiar por dinero.",
        "Cómo se elige: al azar entre las participaciones válidas, dentro de los 3 días siguientes al evento. Contactamos al ganador por mensaje directo desde {instagram}. Si no responde en 7 días, se elige a otra persona.",
        "No es necesario comprar nada para participar. Podemos descalificar participaciones falsas o que no cumplan estas bases.",
        "Instagram no patrocina, avala ni administra esta promoción y queda liberado de cualquier responsabilidad. Usamos tu usuario de Instagram solo para contactarte si ganas.",
        "Dudas: {contacto}."
      ] },
    { t: "Propiedad intelectual",
      p: ["La marca Palma Blanca, su logo, fotos, recetas y textos son de {responsable}. Puedes compartir las imágenes que genera la app en tus redes, pero no usarlas con fines comerciales."] },
    { t: "Responsabilidad",
      p: ["La app se ofrece «tal cual». Hacemos lo posible para que funcione bien, pero puede tener fallas o dejar de estar disponible. Cada persona es responsable de lo que decide tomar y de su comportamiento en el evento."] },
    { t: "Cambios y ley aplicable",
      p: ["Podemos actualizar estos términos; la versión vigente es la que aparece en la app. Se rigen por las leyes de los Estados Unidos Mexicanos."] }
  ]
};
