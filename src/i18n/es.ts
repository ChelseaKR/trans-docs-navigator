// Spanish bundle. Typed against LocaleBundle, so a missing or extra key is a
// compile error — Spanish parity is enforced by the compiler, then proven
// end-to-end by tests/spanish-parity.test.ts.

import type { LocaleBundle } from "./types.ts";

export const es: LocaleBundle = {
  language: "es",
  selfName: "Español",

  ui: {
    skip: "Saltar al contenido principal",
    bannerTitle: "Información, no asesoramiento legal",
    bannerBody: "Asistido por IA, basado en fuentes citadas.",
    footer: "Sus respuestas permanecen en su navegador. Nada de lo que escribe se envía ni se almacena en un servidor.",
    legalNav: "Legal y políticas",
    termsLink: "Términos de uso",
    privacyLink: "Privacidad",
    a11yLink: "Accesibilidad",
    verifyNote: "Esto es información general, no asesoramiento legal. Los requisitos cambian, así que confirme siempre con la fuente oficial enlazada en cada paso, y hable con un abogado o una organización de ayuda legal sobre su situación específica.",
    notFilingNote: "Esta herramienta no presenta nada por usted y no es asesoramiento legal. Descargue el formulario oficial, complételo y preséntelo usted mismo.",
    sources: "Fuentes",
    lastChecked: "verificado por última vez",
    needsRecheck: "Necesita reverificación, así que no se muestra como actual.",
    discretionary: "Varía según el tribunal/secretario.",
    cost: "Costo",
    timeline: "Tiempo estimado",
    prereq: "Hacer primero",
    step: "Paso",
    print: "Imprimir o guardar como PDF",
    startOver: "Empezar de nuevo",
    prepared: "Preparado el",
    packetIntro: "Su plan completo, listo para imprimir o guardar. No contiene información sobre usted más allá de las opciones que eligió.",
    private: "Modo privado: sin cuenta, nada se guarda. Cerrar esta pestaña borra todo.",
    notCovered: "Aún no cubierto",
    resumeTitle: "Guarde su progreso (opcional, en este dispositivo)",
    resumeIntro: "Guarde solo sus selecciones, sin nombres, cifradas con una contraseña que usted elige. Permanece en este dispositivo y nunca se envía a ningún lugar. Si olvida la contraseña, no se puede recuperar.",
    passLabel: "Contraseña",
    saveBtn: "Guardar (cifrado)",
    resumeBtn: "Reanudar",
    deleteBtn: "Eliminar lo guardado",
    intakeHeading: "Planifique sus cambios legales de nombre y marcador de género",
    intakeLead: "Responda algunas preguntas y obtenga una lista personalizada y ordenada con los formularios correctos y las fuentes oficiales para su estado. También puede usarla sin ingresar datos personales.",
    whereLive: "¿Dónde vive?",
    stateLabel: "Estado",
    whatChanging: "¿Qué está cambiando?",
    changeNameLabel: "Nombre legal",
    changeMarkerLabel: "Marcador de género",
    whichDocs: "¿Qué documentos desea actualizar? (deje todo sin marcar para el conjunto recomendado)",
    languageLegend: "Idioma",
    submitChecklist: "Mostrar mi lista",
    checklistTitle: "Su lista",
    checklistHeading: "Su lista personalizada",
    checklistIntro: "Sus pasos se enumeran en el orden en que la mayoría de las personas los completa. Cada uno enlaza a su fuente oficial y la fecha en que se verificó por última vez.",
    packetTitle: "Su paquete",
    packetHeading: "Su paquete de cambio de nombre y marcador de género",
    answerHeading: "Lo que dicen las fuentes",
    formPrivacy: "Lo que escribe aquí permanece en su navegador. El formulario se llena en su dispositivo y nunca se envía a ningún lugar.",
    fillDownload: "Llenar y descargar",
    flatScanIntro: "Este formulario oficial es una imagen escaneada que no se puede llenar automáticamente. Descargue el formulario en blanco y complételo a mano:",
    gapNoRecords: "Aún no tenemos pasos verificados para esto. Consulte el sitio web oficial de su estado o una organización de ayuda legal para personas trans.",
    gapAllDegraded: "La información que tenemos sobre esto puede haber cambiado y necesita reverificación; no la mostraremos como actual. Consulte la fuente oficial.",
    noStepsLead: "Todavía no pudimos crear pasos verificados para estas opciones.",
    notFoundHeading: "Página no encontrada",
    notFoundBody: "No pudimos encontrar esa página.",
    badRequestHeading: "Solicitud no válida",
    badRequestBody: "Ese no es un estado que reconozcamos. Por favor, elija uno de la lista.",
    methodHeading: "Método no permitido",
    methodBody: "Por favor, use GET.",
    backToChecklist: "Volver a su lista",
    backToStart: "Empezar de nuevo",
    privacyLabel: "Privacidad:",
    resEnterPass: "Ingrese una contraseña primero.",
    resSaved: "Guardado en este dispositivo, cifrado. No se envió nada a ningún lugar.",
    resNothing: "No hay nada guardado en este dispositivo.",
    resWrong: "Contraseña incorrecta, o los datos guardados fueron modificados.",
    resDeleted: "Eliminado de este dispositivo.",
    fillFilling: "Llenando en su dispositivo…",
    fillDone: "Listo: su formulario llenado se descargó. Nunca se envió a un servidor.",
    fillUnfilled: "Descargado. Estos campos no se pudieron llenar automáticamente; complételos a mano: ",
    fillError: "No se pudo llenar el formulario. Puede descargar el formulario en blanco.",
    thinnerCoverage: "Los pasos completos en español para este estado aún no están listos. Se muestran los pasos federales; cambie a inglés para ver más.",
    fillFormCta: "Llene este formulario en su dispositivo",
    getFormCta: "Obtenga el formulario oficial",
    moreDetail: "Más detalle",
    markDone: "Marcar como hecho",
    alreadyDone: "Ya hecho",
    reportError: "¿Desactualizado? Informe de un error o una ley que cambió",
    // PENDING native-speaker review (no attestation) + counsel review — destination-disclosure copy; see docs/audits/dpia.md [Added 2026-07-09] row.
    reportErrorNote: "Este enlace abre GitHub en una pestaña nueva. Los informes son públicos y requieren una cuenta de GitHub.",
    progressTemplate: "{done} de {total} pasos hechos",
    stepsLabel: "pasos",
    estimatedCost: "Costo estimado",
    varies: "varía",
    moreHeading: "Más información",
    seeDetailedAnswer: "Vea en detalle lo que dicen las fuentes",
    officialFormIntro: "Este es un formulario oficial del gobierno. Descárguelo desde la fuente a continuación y complételo usted mismo: no lo llenamos por usted, así que siempre trabaja con la versión oficial.",
    copyTitle: "Sus datos, listos para copiar",
    copyIntro: "Ingrese su nombre una vez y cópielo en el formulario oficial. Esto permanece en su navegador: no se envía a ningún lugar.",
    copyBtn: "Copiar",
    copied: "Copiado al portapapeles.",
    offlineTitle: "Guardar sin conexion (opcional, en este dispositivo)",
    offlineIntro: "Guarde una copia de su lista y paquete en este dispositivo para releerlos sin conexion a internet. Las copias guardadas no estan cifradas: cualquiera que pueda abrir este navegador puede leerlas. Si alguien revisando su dispositivo es un riesgo para usted, no guarde, o elimine las copias cuando termine.",
    offlineSaveBtn: "Guardar sin conexion",
    offlineRemoveBtn: "Eliminar copias sin conexion",
    offlineSaving: "Guardando en este dispositivo...",
    offlineSaved: "Guardado en este dispositivo el {date}. Nada se envio a ningun lugar.",
    offlineHaveCopy: "Una copia sin conexion de esta pagina esta guardada en este dispositivo.",
    offlineRemoved: "Todas las copias sin conexion se eliminaron de este dispositivo.",
    offlineError: "No se pudo guardar en este dispositivo. Aun puede imprimir o guardar como PDF.",
    offlineUnsupported: "Este navegador no puede guardar paginas para uso sin conexion.",
    offlineUpdated: "La aplicacion sin conexion se actualizo. Sus paginas guardadas se conservaron.",
    offlineBanner: "Copia guardada del {date}. Las leyes cambian: si ha pasado mas de {days} dias, vuelva a verificar cada paso en su fuente oficial antes de actuar.",
    offlinePageTitle: "Está sin conexion",
    offlineHeading: "Está sin conexion",
    offlineLead: "Esta pagina aparece porque no tiene conexion a internet en este momento. Si guardo paginas para uso sin conexion, se enumeran a continuacion y se abriran sin una conexion.",
    offlineSavedHeading: "Guardado en este dispositivo",
    offlineNoneSaved: "No hay paginas guardadas para uso sin conexion en este dispositivo.",
    downloadIcs: "Agregue estos pasos a su calendario (.ics)",
    // PENDING native-speaker review (no attestation) + counsel review — privacy-representation copy (docs/audits/dpia.md [Added 2026-07-09] .ics row).
    downloadIcsNote: "Crea un archivo de lista de tareas en su dispositivo. Solo contiene los nombres de los pasos, sin datos personales. Este sitio no envía nada. Si agrega el archivo a un calendario en línea, su proveedor de calendario guardará los nombres de los pasos.",
  },

  docTitles: {
    "court-order": "Obtenga una orden judicial para su cambio de nombre",
    "ssa-card": "Actualice su registro del Seguro Social",
    "drivers-license": "Actualice su licencia de conducir o identificación estatal",
    passport: "Actualice su pasaporte de EE. UU.",
    "birth-certificate": "Modifique su acta de nacimiento",
    "financial-records": "Actualice registros financieros y otros",
  },

  docLabels: {
    "court-order": "Orden judicial",
    "ssa-card": "Tarjeta de Seguro Social",
    "drivers-license": "Licencia de conducir / identificación estatal",
    passport: "Pasaporte de EE. UU.",
    "birth-certificate": "Acta de nacimiento",
    "financial-records": "Registros financieros y otros",
  },

  fieldLabels: {
    new_legal_name: "Nuevo nombre legal",
    current_legal_name: "Nombre legal actual",
    has_court_order: "Tengo una orden judicial",
  },

  generator: {
    costVaries: (note?: string) => (note ? ` El costo varía: ${note}` : " El costo varía."),
    costAbout: (amt: number, waiver: boolean) =>
      ` El costo típico es de aproximadamente $${amt}.${waiver ? " Puede haber una exención de tarifa si no puede pagarla." : ""}`,
    timeline: (typ: string, note?: string) => ` Tiempo estimado: ${typ}.${note ? ` ${note}` : ""}`,
    intro: "Esto es lo que dicen las fuentes oficiales para su situación. Cada punto enlaza a su fuente y la fecha en que se verificó por última vez.",
    discretionary: "Este paso es discrecional. El resultado puede variar según el tribunal o el secretario, así que considérelo un camino probable, no una garantía.",
    refusal:
      "Todavía no tengo información verificada sobre eso, así que no puedo darle una respuesta que pueda respaldar. " +
      "Consulte directamente la fuente oficial, o pruebe una jurisdicción y un documento que cubra actualmente.",
    freshness: (topic: string, date: string, title: string) =>
      `Una regla relacionada (${topic}) puede haber cambiado y necesita reverificación. La verifiqué por última vez el ${date}, ` +
      `lo cual está fuera del período de vigencia, así que no la presentaré como actual. Verifíquela directamente en la fuente oficial: ${title}.`,
    disclosure: "Información, no asesoramiento legal. Asistido por IA, basado en fuentes citadas.",
  },

  legal: {
    updatedLabel: "Última actualización:",
    termsTitle: "Términos de uso",
    privacyTitle: "Aviso de privacidad",
    accessibilityTitle: "Declaración de accesibilidad",
    terms: [
      {
        h: "Información, no asesoramiento legal",
        html:
          "<p>Trans Docs Navigator ofrece información general y pública para ayudarle a entender los pasos de un cambio legal de nombre o de marcador de género. <strong>No es asesoramiento legal</strong>, no reemplaza a un abogado, y su uso no crea una relación abogado–cliente. Para consejo sobre su situación específica, hable con un abogado con licencia o con una organización de ayuda legal para personas trans.</p>",
      },
      {
        h: "No garantizamos la exactitud — verifique antes de actuar",
        html:
          "<p>Las leyes, los formularios, las tarifas y los plazos cambian, y varían según el tribunal y el condado. Citamos una fuente oficial y la fecha en que la verificamos por última vez para cada requisito, pero <strong>usted debe confirmar la regla vigente con la fuente oficial antes de actuar o presentar algo</strong>. El servicio se ofrece “tal cual”, sin garantías de ningún tipo.</p>",
      },
      {
        h: "No es un servicio de presentación",
        html:
          "<p>El servicio no presenta nada ante ningún tribunal o agencia por usted. Los formularios que le ayuda a llenar se completan en su propio dispositivo, y <strong>usted es responsable</strong> de revisarlos, completarlos y presentarlos.</p>",
      },
      {
        h: "Limitación de responsabilidad",
        html:
          "<p>En la máxima medida permitida por la ley, el proyecto y sus colaboradores no son responsables de ninguna pérdida o daño derivado del uso o de la confianza en el servicio o su contenido. <em>(Esta sección está sujeta a revisión legal antes del lanzamiento público.)</em></p>",
      },
      {
        h: "Sus responsabilidades",
        html:
          "<p>Use la información de forma lícita y para sus propios fines. Confirme cada requisito con la fuente oficial y busque asesoramiento profesional cuando su situación sea incierta o de alto riesgo.</p>",
      },
      {
        h: "Privacidad",
        html:
          '<p>El servicio está hecho para no recopilar prácticamente nada sobre usted. Consulte el <a href="/privacy?language=es">Aviso de privacidad</a> para más detalles.</p>',
      },
      {
        h: "Contenido y licencia",
        html:
          "<p>Los formularios y textos gubernamentales suelen ser públicos; registramos el origen de cada dato. El código fuente del servicio tiene licencia AGPL-3.0. No puede presentar el servicio como asesoramiento oficial, gubernamental o de un profesional del derecho.</p>",
      },
      {
        h: "Cambios a estos términos",
        html: "<p>Podemos actualizar estos términos. Cuando lo hagamos, cambiará la fecha de “última actualización”. El uso continuado significa que acepta la versión vigente.</p>",
      },
    ],
    privacy: [
      {
        h: "La versión corta",
        html:
          "<p>Diseñamos este servicio para no recopilar prácticamente nada sobre usted. No necesita una cuenta. Sus respuestas permanecen en su navegador. Los formularios se llenan en su dispositivo. <strong>Nada de lo que escribe se envía ni se almacena en nuestros servidores.</strong></p>",
      },
      {
        h: "Lo que nunca recibimos",
        html:
          "<p>Su nombre, fecha de nacimiento, número de Seguro Social y cualquier dato de documentos de identidad <strong>nunca se envían a un servidor</strong>. El llenado de formularios ocurre completamente en su navegador.</p>",
      },
      {
        h: "Lo que se procesa para mostrar su lista",
        html:
          "<p>Para crear su lista, el servicio lee solo opciones no identificativas de la dirección web: su estado, los tipos de documento que eligió y su idioma. No se vinculan con usted como persona.</p>",
      },
      {
        h: "Registros del servidor",
        html:
          "<p>Nuestro servidor mantiene registros técnicos mínimos limitados a una lista fija de campos no identificativos (por ejemplo: qué página, el estado de la respuesta y un código de jurisdicción). No se registra información identificativa, por diseño.</p>",
      },
      {
        h: "Sin cookies, sin rastreadores",
        html: "<p>El servicio no usa rastreadores de publicidad ni de analítica, y no coloca cookies de seguimiento.</p>",
      },
      {
        h: "“Guardar su progreso” (opcional, en su dispositivo)",
        html:
          "<p>Si elige guardar su progreso, solo sus <em>selecciones</em>, nunca su nombre, se cifran con una contraseña que usted elige y se guardan en su propio dispositivo. Nunca se envían a ningún lugar, y puede eliminarlas en cualquier momento con el botón “Eliminar lo guardado” o borrando el almacenamiento de su navegador.</p>",
      },
      {
        h: "Opcional \"Guardar sin conexion\" (en su dispositivo)",
        html:
          "<p>Si elige guardar paginas para uso sin conexion, las copias se guardan <strong>sin cifrar</strong> en el almacenamiento de su navegador, en su propio dispositivo - nunca en nuestros servidores. Cualquiera que pueda abrir su navegador o inspeccionar el dispositivo podria leerlas. Si eso es un riesgo para usted, no guarde, o use el boton \"Eliminar copias sin conexion\" (o borre el almacenamiento de su navegador) cuando termine. Guardar nunca envia nada a ningun lugar: la funcion sin conexion no hace sincronizacion en segundo plano, notificaciones push ni obtiene nada que no le pidiera. Cada pagina guardada muestra la fecha en que se guardo, porque las leyes cambian y una copia antigua puede quedar obsoleta.</p>",
      },
      {
        h: "Por qué lo hicimos así",
        html:
          "<p>Suponemos que algunas personas que lo usan pueden estar en lugares hostiles hacia las personas trans. La mejor protección es no tener nada que entregar, así que el servicio está hecho para no guardar nada sobre usted.</p>",
      },
      {
        h: "Sus opciones",
        html:
          "<p>Como no almacenamos nada sobre usted en nuestros servidores, no hay nada que podamos eliminar o divulgar a pedido. Usted mantiene el control de cualquier dato guardado localmente en su dispositivo.</p>",
      },
    ],
    accessibility: [
      {
        h: "Nuestro objetivo",
        html: "<p>Buscamos cumplir con <strong>WCAG 2.2 nivel AA</strong>. La accesibilidad es un requisito de lanzamiento, no algo secundario.</p>",
      },
      {
        h: "Lo que hacemos",
        html:
          "<ul><li>HTML semántico con un enlace para saltar al contenido y controles etiquetados.</li><li>El flujo principal funciona <strong>sin JavaScript</strong>.</li><li>Rutas completas con teclado y foco siempre visible.</li><li>Contraste de color suficiente, verificado automáticamente en cada cambio.</li><li>Compatibilidad con movimiento reducido y un diseño tranquilo y de baja estimulación.</li><li>Legible al 200% de zoom y en pantallas pequeñas.</li></ul>",
      },
      {
        h: "Lo que aún está en progreso",
        html:
          "<p>Un recorrido manual completo con lector de pantalla, solo teclado y zoom es parte de nuestro proceso de lanzamiento y se está completando antes del lanzamiento público. Las comprobaciones automáticas (axe/pa11y y contraste de color) se ejecutan en cada cambio.</p>",
      },
      {
        h: "Cuéntenos sobre una barrera",
        html:
          "<p>Si algo es difícil de usar, háganoslo saber abriendo un problema en el repositorio del proyecto. Tratamos las barreras de accesibilidad como errores.</p>",
      },
    ],
  },

  seo: {
    homeTitle: "Guía de cambio de nombre y marcador de género, por estado",
    homeDescription:
      "Pasos claros y citados para cambiar su nombre legal y marcador de género en EE. UU., con los formularios y fuentes oficiales de su estado. No es asesoramiento legal.",
    guideIndexTitle: "Guías de cambio de nombre y marcador de género por estado",
    guideIndexDescription:
      "Guías citadas y actuales para cambiar su nombre legal y marcador de género en cada estado que cubrimos: orden judicial, Seguro Social, DMV y pasaporte.",
    guideIndexLead:
      "Elija su estado y lo que va a cambiar. Cada guía enumera los pasos en orden, con costos, plazos y un enlace a la fuente oficial de cada requisito.",
    guideIndexAllHeading: "Todas las guías",
    topicName: { name: "Cambio de nombre", "gender-marker": "Cambio de marcador de género" },
    guideTitle: (state, topic) => `${topic} en ${state}: pasos, formularios y costos`,
    guideHeading: (state, topic) => `${topic} en ${state}`,
    guideDescription: (state, topic) =>
      `Cómo completar un ${topic.toLowerCase()} en ${state}: los pasos en orden, cuánto cuesta cada uno, cuánto tarda y la fuente oficial de cada requisito.`,
    guideLead: (state, topic) =>
      `Estos son los pasos que la mayoría de las personas sigue para un ${topic.toLowerCase()} en ${state}, en orden. Cada uno enlaza a su fuente oficial y la fecha en que lo verificamos por última vez. Cuando esté listo, cree una lista personalizada que cubra todos los documentos a la vez.`,
    guideCta: "Crear mi lista personalizada",
    guideReviewed: "Última revisión",
    breadcrumbHome: "Inicio",
    breadcrumbGuides: "Guías",
    legalDescription: {
      terms: "Los términos para usar Trans Docs Navigator: información general, no asesoramiento legal, sin garantía. Verifique cada requisito con la fuente oficial.",
      privacy: "Cómo le protege Trans Docs Navigator: sin cuenta, nada de lo que escribe se envía a un servidor, sin rastreadores, formularios llenados en su dispositivo.",
      accessibility: "Nuestro compromiso de accesibilidad WCAG 2.2 AA para Trans Docs Navigator, lo que probamos automáticamente y cómo informar una barrera.",
    },
  },
};
