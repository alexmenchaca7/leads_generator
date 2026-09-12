"use client";

import { useState } from "react";
import Link from "next/link";
import { Logo } from "../dashboard/ui";

// ── Datos de la guía ──────────────────────────────────────────────────────────
// Todo el contenido vive como datos para que agregar un guion o una objeción sea
// editar un arreglo, no pelearse con el JSX.

const RULES: { title: string; body: string }[] = [
  {
    title: "WhatsApp Business, nunca el personal",
    body: "Foto de logo, nombre de la agencia, catálogo con 3 trabajos y horario. El negocio ve tu perfil antes de leer el mensaje: si ve un número pelón, no contesta.",
  },
  {
    title: "Sin links en el primer mensaje",
    body: "Un link de alguien desconocido dispara el reflejo de estafa y además WhatsApp lo penaliza. El link va hasta el segundo mensaje, cuando ya te contestaron.",
  },
  {
    title: "Cuatro líneas máximo",
    body: "Se decide en la vista previa de la notificación. Si tienen que abrir el chat para entender de qué va, ya perdiste la mitad.",
  },
  {
    title: "Una personalización real",
    body: "Algo que solo se sabe mirando su ficha: sus reseñas, sus fotos, que contestan los comentarios. Sin eso es plantilla y se nota.",
  },
  {
    title: "Martes a jueves, 10–13 h",
    body: "Lunes están apagando fuegos y viernes ya se fueron. La segunda mejor ventana es 16–18 h. Nunca domingos: es la vía rápida al bloqueo.",
  },
  {
    title: "20–25 mensajes por día, por número",
    body: "Más que eso con un número nuevo y WhatsApp lo suspende. Varía el texto entre envíos: copiar y pegar idéntico 40 veces es la firma de un bot.",
  },
];

type Tone = "emerald" | "amber" | "slate";

const TONE: Record<Tone, { bar: string; ph: string; chip: string }> = {
  emerald: {
    bar: "bg-emerald-500",
    ph: "bg-emerald-500/15 text-emerald-300",
    chip: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
  },
  amber: {
    bar: "bg-amber-500",
    ph: "bg-amber-500/15 text-amber-300",
    chip: "bg-amber-500/15 text-amber-300 ring-amber-500/30",
  },
  slate: {
    bar: "bg-slate-500",
    ph: "bg-slate-700 text-slate-300",
    chip: "bg-slate-700/60 text-slate-300 ring-slate-600",
  },
};

const SCRIPTS: {
  title: string;
  when: string;
  tone: Tone;
  incoming?: string;
  body: string[];
  why: string;
}[] = [
  {
    title: "A · Primer contacto — sin_web",
    when: "Día 0",
    tone: "emerald",
    body: [
      "Hola, buen día. ¿Hablo con {{negocio}}?",
      "Soy {{tu nombre}}, hago páginas web aquí en Guadalajara. Los vi en Google Maps: {{rating}}★ con {{reseñas}} reseñas, les va muy bien.\n\nNada más noté que no tienen página propia — así, quien los busca en Google fuera de Maps no los encuentra.\n\n¿Le interesa que le muestre cómo se vería la suya? Sin costo y sin compromiso.",
    ],
    why: "Abre con un halago verificable (sus números reales), nombra el hueco sin regañar, y cierra con una pregunta de sí/no que no compromete a nada. Nunca dice “te vendo”.",
  },
  {
    title: "B · Primer contacto — solo_redes",
    when: "Día 0",
    tone: "amber",
    body: [
      "Hola, ¿hablo con {{negocio}}?",
      "Soy {{tu nombre}}, desarrollo páginas web en Guadalajara. Vi su ficha en Maps y que tienen su {{Facebook/Instagram}} puesto como sitio web.\n\nEso les sirve, pero no aparece cuando alguien busca en Google “{{giro}} en {{municipio}}” — ahí se están yendo con el que sí tiene página.\n\n¿Le enseño cómo se vería la suya? Son 2 minutos de verlo.",
    ],
    why: "No les dice que hicieron algo mal: les dice que lo que tienen se queda corto en un lugar concreto. La búsqueda que menciona es la que ellos mismos han tecleado alguna vez para verse.",
  },
  {
    title: "C · Si contesta recepción o un empleado",
    when: "Al momento",
    tone: "slate",
    incoming: "¿De parte de quién? / ¿Qué necesita?",
    body: [
      "Claro, disculpe. Es sobre la página web del negocio — ¿con quién puedo tratar eso, con el dueño o con quien lleva la administración?\n\nSi me pasa su nombre yo le escribo directo y no los distraigo a ustedes. 🙏",
    ],
    why: "Le quita el trabajo a quien contesta en vez de pedirle que decida. Pedir el nombre —no el teléfono— es una petición chica que casi siempre se concede, y con el nombre el siguiente mensaje ya no es frío.",
  },
  {
    title: "D · Seguimiento 1 — no contestaron",
    when: "72 horas después",
    tone: "slate",
    body: [
      "{{Nombre}}, le escribí el {{día}} por lo de la página. Le dejo una que hice para {{negocio parecido}} para que vea a qué me refiero: {{link}}\n\nSi no es el momento no hay bronca — ¿le marco en unos meses o mejor lo dejamos así?",
    ],
    why: "Aquí sí va el link, y va un caso de su mismo giro. El cierre le da permiso explícito de decir que no — esa salida es justo lo que destraba la respuesta, y muchas veces la respuesta es “no, sí me interesa, es que ando full”.",
  },
  {
    title: "E · Seguimiento 2 — el último",
    when: "Día 10 · y ya",
    tone: "slate",
    body: [
      "{{Nombre}}, última de mi parte para no andar insistiendo.\n\n¿Cierro su archivo o le late que le mande la propuesta?",
    ],
    why: "Dos líneas, cero presión, y una pregunta binaria que cuesta menos responder que ignorar. Es el mensaje con mejor tasa de respuesta de toda la secuencia. Después de este, márcalo “no contestó” y no vuelvas en 6 meses.",
  },
  {
    title: "F · Dijeron que sí quieren ver",
    when: "Contesta en menos de 1 h",
    tone: "emerald",
    incoming: "Sí, mándame info / A ver, enséñame",
    body: [
      "Va. Para no mandarle algo genérico: ¿qué es lo que más le gustaría que hiciera la gente al entrar — que les llame, que aparte cita, o que vea el {{menú/catálogo}}?\n\nCon eso le armo la muestra con sus fotos y su información real, y se la paso el {{día}}.",
    ],
    why: "“Mándame info” normalmente es un no amable. Esto lo convierte en compromiso: una pregunta que los hace imaginar su sitio funcionando, y una fecha que crea una cita implícita. Además te da lo único que necesitas saber para la maqueta.",
  },
  {
    title: "G · Entregas la maqueta y pides la llamada",
    when: "24–48 h después",
    tone: "emerald",
    body: [
      "Listo {{Nombre}}, aquí está: {{link a la maqueta}}\n\nEs su información real, con sus fotos de Maps. Ábrala en el celular, que así la va a ver la mayoría de sus clientes.\n\n¿Tiene 10 minutos mañana para que le explique cómo se conecta con su WhatsApp y qué faltaría? ¿Le queda mejor {{11 am}} o {{5 pm}}?",
    ],
    why: "Ver su propio negocio ya montado es el momento en que la venta se hace real — de aquí en adelante estás quitando algo que ya sienten suyo. El cierre ofrece dos horarios, no pregunta si quieren llamada.",
  },
  {
    title: "H · Preguntaron el precio antes de tiempo",
    when: "Cuando salga",
    tone: "slate",
    incoming: "¿Cuánto cobras?",
    body: [
      "Depende de cuántas secciones lleve y de si quiere {{citas/pedidos}} en línea. El rango que manejo va de {{$X}} a {{$Y}}, con dominio y hosting del primer año incluidos.\n\nPara darle el número exacto necesito saber dos o tres cosas de su operación. ¿Tiene 10 minutos hoy a las {{5}} o mañana temprano?",
    ],
    why: "No esquivar la pregunta —eso enfría— pero tampoco soltar un número solo, que sin contexto siempre suena caro. Das rango, lo justificas con dos variables y lo usas de puente a la llamada.",
  },
];

const STEPS: { title: string; body: string; bullets?: string[] }[] = [
  {
    title: "Arma la lista del día",
    body: "En el tablero o la tabla: prioridad alta, con teléfono, estado “pendiente”. Saca 20. No más, aunque te sobre tiempo — de nada sirve mandar 60 si no puedes darle seguimiento a 60.",
  },
  {
    title: "Un minuto por ficha",
    body: "Abre su Maps. Anota la línea personalizada y, de paso, guarda 2 o 3 fotos suyas: las vas a necesitar en el paso 4. Súbelas a la tarjeta del tablero para tenerlas a la mano.",
  },
  {
    title: "Manda el guion A o B",
    body: "Según su presencia web. Arrastra la tarjeta a “contactado” en cuanto lo mandes; si no lo registras en el momento, no lo registras.",
  },
  {
    title: "Maqueta para quien contestó",
    body: "Una sola pantalla, en móvil, con su nombre, sus fotos, su teléfono y un botón de WhatsApp que sirva. Dos o tres horas de trabajo, y solo para quien ya levantó la mano.",
    bullets: [
      "Que se vea su logo y sus colores, aunque los saques de la fachada.",
      "Un solo botón principal: llamar, agendar o pedir. El que te dijeron en el guion F.",
      "Súbela con un link real y que cargue rápido. Un PDF no causa el mismo efecto.",
    ],
  },
  {
    title: "Llamada de 10 minutos",
    body: "No es una presentación, es un diagnóstico. Hablas un tercio del tiempo. Las cinco preguntas están abajo.",
  },
  {
    title: "Propuesta el mismo día",
    body: "Mientras siguen calientes. Tres paquetes, una página, con las palabras que ellos usaron en la llamada. Vigencia de 7 días y dilo sin drama.",
  },
  {
    title: "Cierre y anticipo",
    body: "50 % para arrancar, 50 % contra entrega. El anticipo no es solo dinero: es el filtro que separa al que va en serio del que te va a traer tres meses dando vueltas. Sin anticipo no se abre el proyecto.",
  },
  {
    title: "Los que no cerraron siguen valiendo",
    body: "Un “no interesado” de hoy es un cliente de marzo. Deja la maqueta en la tarjeta, ponle fecha de seguimiento a 90 días y vuelve con algo nuevo, no con el mismo mensaje.",
  },
];

const QUESTIONS: { ask: string; goal: string }[] = [
  {
    ask: "¿Cómo lo encuentran hoy sus clientes nuevos?",
    goal: "Te dicen solos que dependen de que pasen por la calle o de recomendación. Ese es el problema que tu sitio resuelve, dicho con sus palabras.",
  },
  {
    ask: "¿Más o menos cuánto le deja un cliente nuevo?",
    goal: "El número con el que vas a justificar el precio. Si un paciente vale $3,000, un sitio de $15,000 son cinco pacientes. Deja que ellos hagan la cuenta en voz alta.",
  },
  {
    ask: "Cuando alguien entre a la página, ¿qué quiere que haga?",
    goal: "Define el alcance y evita el sitio de diez secciones que nadie necesita. También le da un objetivo medible al proyecto.",
  },
  {
    ask: "¿Ya habían intentado hacer una? ¿Qué pasó?",
    goal: "La pregunta más útil de las cinco. Casi siempre hay un sobrino que la dejó a medias o alguien que cobró y desapareció. Ahí te enteras de qué miedo tienes que desactivar.",
  },
  {
    ask: "Además de usted, ¿alguien más opina en esto?",
    goal: "El socio invisible es la causa número uno de propuestas que se enfrían sin explicación. Mejor saberlo ahora y mandarle la propuesta a los dos.",
  },
];

const INDUSTRIES: [string, string, string][] = [
  ["Dental", "Que el paciente compare tres clínicas y las otras dos sí tengan página con precios.", "Agenda en línea y página de precios. Un implante paga el sitio completo."],
  ["Salud / Consultorio", "Aparecen en Doctoralia, que les cobra comisión y les manda al paciente a la competencia.", "Su propia ficha, sin intermediario que cobre por cada cita."],
  ["Restaurante", "Mandan el menú por foto de WhatsApp y las apps les muerden 30 % de cada orden.", "Menú que se actualiza sin reimprimir, reservas y pedido directo."],
  ["Abogados", "Venden confianza y no tienen dónde probarla. El cliente los googlea antes de llamar.", "Casos, credenciales y formulario de consulta. Ticket alto, ciclo corto."],
  ["Belleza / Spa", "Se les va media hora diaria contestando “¿cuánto cuesta?” y “¿tienes lugar?” por DM.", "Lista de servicios con precios y reservación. Recuperan tiempo, no solo clientes."],
  ["Automotriz", "El cliente no sabe si le van a ver la cara. Necesita ver el taller antes de dejar su coche.", "Fotos del taller, servicios, garantías y cotización por WhatsApp."],
  ["Inmobiliaria", "Dependen de portales que le muestran al mismo cliente ocho propiedades de la competencia.", "Catálogo propio con fichas y fotos. El giro que más rápido entiende el valor."],
  ["Gimnasio / Fitness", "Horarios y planes viven en un story que se borra a las 24 horas.", "Horarios fijos, planes y registro en línea. Menos preguntas repetidas."],
  ["Eventos", "Todo se vende por fotos y las suyas están enterradas en Facebook.", "Galería, capacidades y disponibilidad. Ticket alto, decisión emocional."],
];

const OBJECTIONS: { said: string; reply: string; tip: string }[] = [
  {
    said: "Está muy caro.",
    reply: "“Lo entiendo. ¿Caro comparado con qué — con otra cotización que le pasaron, o con lo que tenía pensado invertir?”",
    tip: "Son dos objeciones distintas y se contestan distinto. Si es comparación, explicas qué incluye lo tuyo que no incluye lo otro. Si es presupuesto, bajas de paquete o partes el pago — nunca bajas el precio del mismo alcance, porque le enseñas que tu primer número era inflado.",
  },
  {
    said: "Con el Facebook y el Instagram me va bien.",
    reply: "“Qué bueno, y no le estoy diciendo que los suelte. La diferencia es que ahí llega el que ya lo conoce. La página es para el que busca su giro en su zona a las 11 de la noche y todavía no sabe que usted existe.”",
    tip: "Nunca pelees contra las redes. Posiciona el sitio como otro canal, no como reemplazo.",
  },
  {
    said: "Déjame lo platico con mi socio.",
    reply: "“Claro. ¿Qué le parece si nos conectamos los tres 10 minutos? Así le contesto directo lo que pregunte y usted no tiene que explicarle lo técnico.”",
    tip: "Si no logras la junta, al menos pregunta qué le va a preguntar el socio y mándale un audio corto de 40 segundos para que lo reenvíe.",
  },
  {
    said: "Ahorita no, tal vez más adelante.",
    reply: "“Sin problema. ¿Le marco en 2 meses o prefiere que le avise cuando tenga un espacio? Le dejo la muestra guardada por si acaso.”",
    tip: "Fecha concreta o nada. “Más adelante” sin fecha es un no que no quisieron decir. Ponle fecha de seguimiento en la tarjeta, no lo dejes eterno en “interesado”.",
  },
  {
    said: "Ya me hicieron una y quedó mal / me robaron.",
    reply: "“Pasa más de lo que cree, y por eso trabajo al revés: usted ya vio la muestra antes de pagar nada, el dominio y el hosting quedan a su nombre desde el día uno, y el 50 % restante lo paga hasta que la vea publicada.”",
    tip: "Es la mejor objeción que te pueden dar: ya está convencido de que necesita un sitio, solo tiene miedo. Todo lo que digas aquí debe reducir su riesgo, no subir el valor.",
  },
  {
    said: "Mi sobrino me la va a hacer.",
    reply: "“Perfecto, ojalá le salga. Le dejo la muestra por si se atora o si se tarda — no le cobro nada por guardársela.”",
    tip: "No compitas contra el sobrino, se pone incómodo y es familia. Seguimiento a 60 días: una proporción alta de estos proyectos nunca se termina.",
  },
];

const PACKS: { name: string; price: string; items: string[]; role: string; best?: boolean }[] = [
  {
    name: "Presencia",
    price: "$6,000 – $9,000",
    items: ["Una página, todo en scroll", "Servicios, ubicación, horarios", "Botón de WhatsApp y llamada", "Dominio y hosting año 1"],
    role: "Para el negocio chico que solo necesita existir en Google.",
  },
  {
    name: "Negocio",
    price: "$14,000 – $20,000",
    items: ["4 a 6 secciones", "Galería y reseñas de Maps", "Formulario a su correo", "Google Maps y analítica", "Dominio y hosting año 1"],
    role: "El que cierra 7 de cada 10 veces. Este es el que propones.",
    best: true,
  },
  {
    name: "Operación",
    price: "$28,000 – $45,000",
    items: ["Todo lo anterior", "Citas o pedidos en línea", "Catálogo o menú administrable", "Capacitación para actualizarlo"],
    role: "Clínicas, restaurantes, inmobiliarias. Sube el ancla de los otros dos.",
  },
];

const FUNNEL: [string, string, number][] = [
  ["Mensajes enviados", "100", 100],
  ["Contestan algo", "25 – 35", 30],
  ["Aceptan ver la maqueta", "12 – 18", 16],
  ["Llegan a la llamada", "7 – 10", 9],
  ["Piden propuesta", "4 – 6", 5],
  ["Cierran y pagan anticipo", "2 – 4", 3],
];

const MISTAKES: string[] = [
  "Mandar el mismo texto idéntico 40 veces: WhatsApp lo detecta y te suspende el número.",
  "Mandar precio en el primer mensaje: sin contexto todo suena caro y cierra la conversación.",
  "Insistir más de tres veces: ahí es donde te reportan, y los reportes son lo que mata la línea.",
  "Hablar de tecnología. A nadie le importa en qué está hecho, les importa si les va a llegar más gente.",
  "Prometer primer lugar en Google. Es lo que dicen los estafadores y el prospecto ya lo escuchó antes.",
  "Dejar de mover las tarjetas. A los tres días ya no te acuerdas de a quién le seguiste y a quién no.",
];

const SECTIONS: [string, string][] = [
  ["reglas", "Seis reglas"],
  ["quien", "A quién primero"],
  ["guiones", "Los guiones"],
  ["proceso", "El proceso"],
  ["llamada", "La llamada"],
  ["giros", "Por giro"],
  ["objeciones", "Objeciones"],
  ["paquetes", "Paquetes"],
  ["numeros", "Números"],
];

// Resalta los {{campos}} que hay que reemplazar con datos del lead.
function withPlaceholders(text: string, phClass: string) {
  return text.split(/(\{\{[^}]+\}\})/g).map((part, i) =>
    part.startsWith("{{") ? (
      <span key={i} className={`rounded px-1 text-[0.95em] ${phClass}`}>
        {part}
      </span>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

export default function PlaybookGuide() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Logo className="h-9" />
        <Link
          href="/dashboard"
          className="rounded-lg border border-slate-700 px-3 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-800"
        >
          ← Volver al tablero
        </Link>
      </header>

      {/* Portada */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 sm:p-7">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-400">
          Guía de prospección
        </p>
        <h1 className="mt-2 text-2xl font-bold leading-tight text-white sm:text-3xl">
          Playbook de contacto por WhatsApp
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-400">
          Qué escribirle a un negocio que salió en la búsqueda, en qué orden, y cómo llevarlo de un
          mensaje frío a un sitio web vendido. Los guiones cambian según su presencia web: no es lo
          mismo el que no tiene nada que el que ya puso su Facebook.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-300 ring-1 ring-emerald-500/30">
            <i className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> sin_web · el hueco es evidente
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-300 ring-1 ring-amber-500/30">
            <i className="h-1.5 w-1.5 rounded-full bg-amber-400" /> solo_redes · ya saben que les falta
          </span>
        </div>
      </div>

      {/* Índice */}
      <nav className="mt-4 flex flex-wrap gap-2">
        {SECTIONS.map(([id, label]) => (
          <a
            key={id}
            href={`#${id}`}
            className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-400 transition hover:border-indigo-500/50 hover:text-indigo-300"
          >
            {label}
          </a>
        ))}
      </nav>

      {/* ── Reglas ──────────────────────────────────────────────────────────── */}
      <Section
        id="reglas"
        eyebrow="Antes de escribir"
        title="Seis reglas que deciden si te contestan"
        lead="El primer mensaje no vende nada. Su único trabajo es conseguir una respuesta. Todo lo que estorbe ese objetivo —un link, un PDF, un precio, un párrafo largo— sale."
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {RULES.map((r) => (
            <div key={r.title} className="rounded-lg border border-slate-800 bg-slate-900 p-4">
              <h3 className="text-sm font-semibold text-slate-100">{r.title}</h3>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-400">{r.body}</p>
            </div>
          ))}
        </div>
        <Note title="Sobre el número que uses">
          Un número nuevo empieza en 10 mensajes diarios y sube de a poco durante dos semanas. Los
          bloqueos y los reportes de los destinatarios son lo que mata la línea, no el volumen en sí
          — por eso importa tanto que el primer mensaje no parezca spam. Ten un segundo número
          listo; tarde o temprano lo vas a necesitar.
        </Note>
      </Section>

      {/* ── A quién primero ─────────────────────────────────────────────────── */}
      <Section
        id="quien"
        eyebrow="A quién primero"
        title="El tablero ya te ordenó la fila"
        lead="Filtra por prioridad alta y que tenga teléfono. De ahí, el ángulo del mensaje depende del segmento — y el orden de ataque es este:"
      >
        <div className="space-y-3">
          <Segment
            tag="sin_web"
            tone="emerald"
            title="No hay nada en el campo de sitio web"
            note="Empieza aquí"
          >
            El mejor prospecto y el argumento más limpio: existen en Maps y en ningún otro lado.
            Quien los busca por nombre en Google encuentra reseñas de terceros, no a ellos. Si
            además traen 4.5★ y más de 100 reseñas, es un negocio sano que puede pagar.
          </Segment>
          <Segment
            tag="solo_redes"
            tone="amber"
            title="Pusieron su Facebook, su Linktree o la página gratis de Google"
            note="Cierra más rápido"
          >
            Ya entendieron que necesitan estar en línea — lo resolvieron a medias. No hay que
            convencerlos de la idea, solo de mejorar lo que ya tienen. Suelen cerrar en menos
            llamadas que un sin_web, aunque el score los ponga debajo.
          </Segment>
          <Segment tag="con_web" tone="slate" title="Tienen sitio propio" note="No los toques">
            El sistema ya los marca como “no prospecto”. Solo valen si el sitio está claramente roto
            o sin actualizar desde hace años, y eso es otra venta (rediseño) con otro guion. No
            mezcles.
          </Segment>
        </div>
        <Note title="60 segundos de tarea antes de cada mensaje">
          Abre su ficha de Maps. Mira las fotos, lee dos reseñas y fíjate si el dueño las contesta.
          Ahí sale la línea personalizada — y sale también el dato de si el negocio está vivo. Es el
          minuto que separa un 8 % de respuesta de un 30 %.
        </Note>
      </Section>

      {/* ── Guiones ─────────────────────────────────────────────────────────── */}
      <Section
        id="guiones"
        eyebrow="Los guiones"
        title="Mensajes listos para copiar"
        lead="Lo resaltado se reemplaza con datos del lead: el tablero ya te da nombre, rating, reseñas, giro y municipio. Cambia las palabras a tu forma de hablar — sonar como tú importa más que sonar pulido."
      >
        <div className="space-y-4">
          {SCRIPTS.map((s) => (
            <ScriptCard key={s.title} script={s} />
          ))}
        </div>
      </Section>

      {/* ── Proceso ─────────────────────────────────────────────────────────── */}
      <Section
        id="proceso"
        eyebrow="El proceso"
        title="De mensaje frío a anticipo cobrado"
        lead="Ocho pasos en orden. Saltarte el 4 —la maqueta— es lo que hace que la mayoría se quede en “déjame lo checo”."
      >
        <ol className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
          {STEPS.map((st, i) => (
            <li
              key={st.title}
              className="grid grid-cols-[44px_1fr] gap-x-3 border-b border-slate-800 p-4 last:border-b-0"
            >
              <span className="pt-0.5 font-mono text-xs font-semibold tabular-nums text-indigo-400">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-slate-100">{st.title}</h3>
                <p className="mt-1 text-xs leading-relaxed text-slate-400">{st.body}</p>
                {st.bullets && (
                  <ul className="mt-2 space-y-1 pl-4 text-xs text-slate-400">
                    {st.bullets.map((b) => (
                      <li key={b} className="list-disc">
                        {b}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </li>
          ))}
        </ol>
      </Section>

      {/* ── Llamada ─────────────────────────────────────────────────────────── */}
      <Section
        id="llamada"
        eyebrow="La llamada"
        title="Cinco preguntas y te callas"
        lead="Cada una tiene un trabajo. Escríbete las respuestas en la bitácora de la tarjeta: son literalmente el texto de tu propuesta."
      >
        <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
          {QUESTIONS.map((q) => (
            <div key={q.ask} className="border-b border-slate-800 p-4 last:border-b-0">
              <p className="text-sm font-semibold text-slate-100">{q.ask}</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-400">{q.goal}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* ── Por giro ────────────────────────────────────────────────────────── */}
      <Section
        id="giros"
        eyebrow="Por giro"
        title="El gancho cambia según a quién le escribes"
        lead="Las etiquetas son las mismas que el sistema asigna en la columna Industria. Usa el dolor de la columna de en medio como la línea personalizada del primer mensaje."
      >
        <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900">
          <table className="w-full min-w-[640px] text-left text-xs">
            <thead className="border-b border-slate-800 text-[11px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2.5 font-semibold">Industria</th>
                <th className="px-4 py-2.5 font-semibold">Lo que de verdad les duele</th>
                <th className="px-4 py-2.5 font-semibold">Lo que les vendes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {INDUSTRIES.map(([giro, dolor, venta]) => (
                <tr key={giro}>
                  <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-200">{giro}</td>
                  <td className="px-4 py-3 leading-relaxed text-slate-400">{dolor}</td>
                  <td className="px-4 py-3 leading-relaxed text-slate-400">{venta}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* ── Objeciones ──────────────────────────────────────────────────────── */}
      <Section id="objeciones" eyebrow="Objeciones" title="Lo que te van a decir">
        <div className="space-y-3">
          {OBJECTIONS.map((o) => (
            <div key={o.said} className="rounded-lg border border-slate-800 bg-slate-900 p-4">
              <p className="border-l-2 border-slate-700 pl-3 text-sm font-medium text-slate-300">
                “{o.said}”
              </p>
              <p className="mt-2.5 text-sm leading-relaxed text-slate-100">{o.reply}</p>
              <p className="mt-2 text-xs leading-relaxed text-slate-500">{o.tip}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* ── Paquetes ────────────────────────────────────────────────────────── */}
      <Section
        id="paquetes"
        eyebrow="Paquetes"
        title="Tres opciones, siempre"
        lead="Con una sola opción solo pueden decir sí o no. Con tres, la conversación se mueve a cuál. La de en medio es la que quieres vender y por eso va al centro con la mejor relación de valor."
      >
        <div className="grid gap-3 sm:grid-cols-3">
          {PACKS.map((p) => (
            <div
              key={p.name}
              className={`flex flex-col rounded-lg border p-4 ${
                p.best ? "border-indigo-500/50 bg-indigo-500/[0.07]" : "border-slate-800 bg-slate-900"
              }`}
            >
              <h3 className="text-sm font-semibold text-slate-100">{p.name}</h3>
              <p className="mt-1 font-mono text-base font-semibold tabular-nums text-white">{p.price}</p>
              <ul className="mt-3 space-y-1 pl-4 text-xs text-slate-400">
                {p.items.map((it) => (
                  <li key={it} className="list-disc">
                    {it}
                  </li>
                ))}
              </ul>
              <p className="mt-auto pt-3 text-[11px] leading-relaxed text-slate-500">{p.role}</p>
            </div>
          ))}
        </div>
        <Note title="Ajusta estos números a lo tuyo">
          Son rangos de referencia para negocio local en la ZMG, no una lista de precios. Lo que no
          debe cambiar es la estructura: tres niveles, el de en medio como recomendado, y
          mantenimiento aparte — de $600 a $1,500 al mes por hosting, respaldos y cambios chicos. Esa
          mensualidad es la que convierte una venta de una vez en un ingreso que se repite, así que
          ofrécela siempre, aunque la rechacen.
        </Note>
      </Section>

      {/* ── Números ─────────────────────────────────────────────────────────── */}
      <Section
        id="numeros"
        eyebrow="Números"
        title="Qué esperar de 100 mensajes"
        lead="Para que no te desanimes en el mensaje 30. Con los guiones de arriba y la maqueta en el paso 4, así se ve un embudo sano:"
      >
        <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
          {FUNNEL.map(([label, value, pct]) => (
            <div
              key={label}
              className="relative flex items-center justify-between gap-4 border-b border-slate-800 px-4 py-2.5 last:border-b-0"
            >
              <span
                className="absolute inset-y-0 left-0 bg-indigo-500/10"
                style={{ width: `${pct}%` }}
                aria-hidden
              />
              <span className="relative text-sm text-slate-300">{label}</span>
              <span className="relative font-mono text-sm tabular-nums text-slate-400">{value}</span>
            </div>
          ))}
        </div>
        <p className="text-sm leading-relaxed text-slate-400">
          Dos o tres cierres por cada cien mensajes, con ticket promedio de $15,000, son entre
          $30,000 y $45,000 por tanda. Una tanda de 100 se manda en una semana a 20 diarios. El
          cuello de botella no es conseguir leads — el motor te da cientos — es cuántas maquetas
          alcanzas a hacer.
        </p>

        <div className="space-y-2 rounded-lg border border-slate-800 bg-slate-900 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-red-400">Lo que quema el número</p>
          {MISTAKES.map((m) => (
            <p key={m} className="relative pl-5 text-xs leading-relaxed text-slate-400">
              <span className="absolute left-0 top-0 text-red-400">✕</span>
              {m}
            </p>
          ))}
        </div>

        <Note title="Si te piden que no los vuelvas a contactar">
          Bórralo de inmediato y no vuelvas nunca. En el tablero eso es vetar el lead: se va a la
          lista negra y el motor de búsquedas no lo vuelve a levantar. Los datos que trae el motor
          son información pública de negocios, pero el derecho de oposición se respeta a la primera —
          y aparte, un reporte menos es la línea que sigue viva.
        </Note>
      </Section>

      <footer className="mt-8 border-t border-slate-800 pt-5 text-xs leading-relaxed text-slate-500">
        Las columnas del tablero son los pasos de este playbook: <b className="text-slate-400">pendiente</b> →{" "}
        <b className="text-slate-400">contactado</b> → <b className="text-slate-400">no contestó</b> /{" "}
        <b className="text-slate-400">interesado</b> / <b className="text-slate-400">no interesado</b> →{" "}
        <b className="text-slate-400">cliente</b>. Si arrastras la tarjeta mientras lo haces, en un mes sabes
        cuál guion sirve y cuál no.
      </footer>
    </main>
  );
}

// ── Piezas de la guía ─────────────────────────────────────────────────────────
function Section({
  id,
  eyebrow,
  title,
  lead,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  lead?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-4 space-y-4 border-t border-slate-800 pt-8 mt-8">
      <div className="space-y-1.5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{eyebrow}</p>
        <h2 className="text-xl font-bold text-white sm:text-2xl">{title}</h2>
        {lead && <p className="max-w-3xl text-sm leading-relaxed text-slate-400">{lead}</p>}
      </div>
      {children}
    </section>
  );
}

function Note({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-500/[0.06] p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-400">{title}</p>
      <p className="mt-1.5 text-xs leading-relaxed text-slate-300">{children}</p>
    </div>
  );
}

function Segment({
  tag,
  tone,
  title,
  note,
  children,
}: {
  tag: string;
  tone: Tone;
  title: string;
  note: string;
  children: React.ReactNode;
}) {
  const t = TONE[tone];
  return (
    <div className={`rounded-lg border border-slate-800 border-l-[3px] bg-slate-900 p-4 ${
      tone === "emerald" ? "border-l-emerald-500" : tone === "amber" ? "border-l-amber-500" : "border-l-slate-600"
    }`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded px-2 py-0.5 font-mono text-[11px] font-medium ring-1 ${t.chip}`}>{tag}</span>
        <h3 className="text-sm font-semibold text-slate-100">{title}</h3>
        <span className="ml-auto text-[11px] text-slate-500">{note}</span>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-slate-400">{children}</p>
    </div>
  );
}

function ScriptCard({ script }: { script: (typeof SCRIPTS)[number] }) {
  const [copied, setCopied] = useState(false);
  const t = TONE[script.tone];

  async function copy() {
    try {
      await navigator.clipboard.writeText(script.body.join("\n\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
      <header className="flex items-center gap-3 border-b border-slate-800 bg-slate-800/40 px-4 py-3">
        <span className={`h-full w-1 shrink-0 self-stretch rounded-full ${t.bar}`} />
        <h3 className="min-w-0 flex-1 text-sm font-semibold text-slate-100">{script.title}</h3>
        <span className="shrink-0 text-[11px] text-slate-500">{script.when}</span>
      </header>

      <div className="space-y-2 p-4">
        {script.incoming && (
          <p className="max-w-[85%] rounded-lg rounded-bl-sm border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-400">
            {script.incoming}
          </p>
        )}
        {script.body.map((b, i) => (
          <p
            key={i}
            className="ml-auto max-w-[92%] whitespace-pre-wrap rounded-lg rounded-br-sm border border-indigo-500/30 bg-indigo-500/10 px-3 py-2 text-sm leading-relaxed text-slate-200"
          >
            {withPlaceholders(b, t.ph)}
          </p>
        ))}
      </div>

      <footer className="flex flex-wrap items-center gap-3 border-t border-slate-800 px-4 py-3">
        <p className="min-w-[200px] flex-1 text-xs leading-relaxed text-slate-500">
          <b className="font-semibold uppercase tracking-wide text-slate-600">Por qué funciona · </b>
          {script.why}
        </p>
        <button
          onClick={copy}
          className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
            copied ? "bg-emerald-600 text-white" : "bg-indigo-600 text-white hover:bg-indigo-500"
          }`}
        >
          {copied ? "Copiado ✓" : "Copiar"}
        </button>
      </footer>
    </div>
  );
}
