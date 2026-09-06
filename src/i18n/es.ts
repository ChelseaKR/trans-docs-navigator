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
    footer: "Sin cuenta. Los datos de identidad para formularios permanecen en su dispositivo. Las selecciones y preguntas opcionales se envían al servidor para generar una respuesta; consulte Privacidad.",
    legalNav: "Legal y políticas",
    termsLink: "Términos de uso",
    privacyLink: "Privacidad",
    transparencyLink: "Informe de transparencia",
    a11yLink: "Accesibilidad",
    methodologyLink: "Cómo obtenemos y verificamos la información",
    verifyNote: "Esto es información general, no asesoramiento legal. Los requisitos cambian, así que confirme siempre con la fuente oficial enlazada en cada paso, y hable con un abogado o una organización de ayuda legal sobre su situación específica.",
    notFilingNote: "Esta herramienta no presenta nada por usted y no es asesoramiento legal. Descargue el formulario oficial, complételo y preséntelo usted mismo.",
    sources: "Fuentes",
    verifiedBy: "verificado por",
    notHumanVerified: "aún sin verificar por una persona revisora designada",
    recordedOn: "registrado",
    sourceNotWatched: "No podemos revisar esta fuente automáticamente para detectar cambios. Revísela usted antes de presentar su solicitud.",
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
    private: "Modo privado: sin cuenta ni sesión guardada. Cerrar esta pestaña borra el estado local no guardado; ciertos metadatos de solicitud pueden conservarse según el Aviso de privacidad.",
    notCovered: "Aún no cubierto",
    resumeTitle: "Guarde su progreso (opcional, en este dispositivo)",
    resumeIntro: "Guarde solo sus selecciones, sin nombres, cifradas con una contraseña que usted elige. La copia cifrada permanece en este dispositivo y guardarla no hace ninguna solicitud de red; las selecciones ya se usaron para mostrar esta página. Si olvida la contraseña, no se puede recuperar.",
    passLabel: "Contraseña",
    saveBtn: "Guardar (cifrado)",
    resumeBtn: "Reanudar",
    deleteBtn: "Eliminar lo guardado",
    intakeHeading: "Planifique sus cambios legales de nombre y marcador de género",
    intakeLead: "Responda algunas preguntas y obtenga una lista personalizada y ordenada con los formularios correctos y las fuentes oficiales para su estado. Puede usarla sin ingresar su nombre ni datos de una cuenta.",
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
    answerLandmarkLabel: "Respuesta",
    formPrivacy: "Lo que escribe aquí permanece en su navegador y esta herramienta de formularios no lo transmite.",
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
    resSaved: "Copia cifrada guardada en este dispositivo. Esta acción no hizo ninguna solicitud de red.",
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
    feeWaiverAvailable: "Esta tarifa se puede exentar.",
    feeWaiverFormLabel: "Formulario:",
    feeWaiverCriteriaQuote: (quote: string) => `La corte dice: "${quote}"`,
    feeWaiverCriteriaUnstated: "La página de la corte nombra esta exención, pero no publica criterios específicos en línea.",
    noStateCoverage:
      "Todavía no tenemos información verificada para este estado, así que los pasos de abajo cubren solo documentos federales. Este no es un plan completo para el lugar donde vive, y no significa que su estado no le pida nada: simplemente no lo hemos verificado. Empiece por el sitio web oficial de su estado, las páginas de autoayuda de sus tribunales, o una organización de asistencia legal para personas trans.",
    noMinorCoverage:
      "Todavía no tenemos información verificada sobre el cambio de nombre o de marcador de género para menores (personas de menos de 18 años) en este estado. Los pasos de abajo están escritos para adultos y pueden no aplicar al caso de un menor. Quién puede pedir el cambio, qué debe consentir o saber un padre o madre, la edad en que importa el propio consentimiento del menor, y el criterio del tribunal pueden ser diferentes. Consulte con el tribunal de su condado o con una organización de asistencia legal para personas trans antes de basarse en estos pasos.",
    costIncomplete: (n: number) =>
      `${n} paso(s) no tienen ninguna tarifa indicada en nuestras fuentes, así que esto es un mínimo, no un costo completo. No estimamos lo que una fuente no indica.`,
    moreHeading: "Más información",
    seeDetailedAnswer: "Vea en detalle lo que dicen las fuentes",
    helpHeading: "Dónde obtener ayuda",
    helpIntro: "Estas organizaciones publican sus propias guías o pueden ayudarle directamente.",
    officialFormIntro: "Este es un formulario oficial del gobierno. Descárguelo desde la fuente a continuación y complételo usted mismo: no lo llenamos por usted, así que siempre trabaja con la versión oficial.",
    whatToBringTitle: "Qué traer",
    copyTitle: "Sus datos, listos para copiar",
    copyIntro: "Ingrese su nombre una vez y cópielo en el formulario oficial. El nombre ingresado aquí permanece en su navegador y esta herramienta no lo transmite.",
    copyBtn: "Copiar",
    copied: "Copiado al portapapeles.",
    offlineTitle: "Guardar sin conexion (opcional, en este dispositivo)",
    offlineIntro: "Guarde una copia de su lista y paquete en este dispositivo para leerlos sin conexión. Al pulsar Guardar, el navegador solicita esas páginas y los archivos de uso sin conexión a este servicio y luego los almacena localmente; después no hay sincronización en segundo plano ni notificaciones push. Las copias no están cifradas: cualquiera que pueda abrir este navegador puede leerlas. Si alguien que revise su dispositivo es un riesgo, no guarde o elimine las copias al terminar.",
    offlineSaveBtn: "Guardar sin conexion",
    offlineRemoveBtn: "Eliminar copias sin conexion",
    offlineSaving: "Guardando en este dispositivo...",
    offlineSaved: "Obtenido de este servicio y guardado en este dispositivo el {date}. No hay sincronización en segundo plano.",
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
    downloadIcsNote: "Crea un archivo de lista de tareas en su dispositivo. Solo contiene los nombres de los pasos, sin datos personales, y crearlo no hace ninguna solicitud de red. Si agrega el archivo a un calendario en línea, su proveedor de calendario guardará los nombres de los pasos.",
  },

  docTitles: {
    "court-order": "Obtenga una orden judicial para su cambio de nombre",
    "ssa-card": "Actualice su registro del Seguro Social",
    "drivers-license": "Actualice su licencia de conducir o identificación estatal",
    passport: "Actualice su pasaporte de EE. UU.",
    "birth-certificate": "Modifique su acta de nacimiento",
    "financial-records": "Actualice registros financieros y otros",
    "green-card": "Actualice su tarjeta verde (Formulario I-90)",
    "naturalization-certificate": "Actualice su certificado de naturalización (Formulario N-565)",
    ead: "Actualice su permiso de trabajo (Documento de Autorización de Empleo)",
    "selective-service": "Actualice su registro del Servicio Selectivo",
    "military-records": "Corrija su registro de servicio militar (DD-214)",
    "trusted-traveler": "Actualice su membresía de TSA PreCheck o Global Entry",
    "federal-employment-records": "Actualice sus registros de empleo federal",
  },

  docLabels: {
    "court-order": "Orden judicial",
    "ssa-card": "Tarjeta de Seguro Social",
    "drivers-license": "Licencia de conducir / identificación estatal",
    passport: "Pasaporte de EE. UU.",
    "birth-certificate": "Acta de nacimiento",
    "financial-records": "Registros financieros y otros",
    "green-card": "Tarjeta verde (Formulario I-90)",
    "naturalization-certificate": "Certificado de naturalización (Formulario N-565)",
    ead: "Permiso de trabajo (EAD)",
    "selective-service": "Registro del Servicio Selectivo",
    "military-records": "Registro de servicio militar (DD-214)",
    "trusted-traveler": "TSA PreCheck / Global Entry",
    "federal-employment-records": "Registros de empleo federal",
  },

  fieldLabels: {
    new_legal_name: "Nuevo nombre legal",
    current_legal_name: "Nombre legal actual",
    has_court_order: "Tengo una orden judicial",
    for_minor: "¿Es esto para alguien menor de 18 años?",
  },

  // Planificador de mudanza. Solo etiquetas estructurales y advertencias — vea RelocationMessages.
  // PENDING native-speaker review (no attestation) — same posture as the rest of this bundle.
  relocation: {
    moveTitle: "Planifique una mudanza a otro estado",
    moveHeading: "Mudarse a otro estado",
    moveLead:
      "Díganos desde dónde y hacia dónde se muda, y qué documentos ya tiene. Le mostraremos qué cambia con la mudanza, en qué orden y cuánto cuesta cada paso — con una fuente para cada paso.",
    movePrivacy:
      "No guardamos a dónde se muda. No hay cuenta. No registramos los estados que elige ni los conservamos después de crear esta página.",
    fromLegend: "Dónde vive ahora",
    fromLabel: "Estado actual",
    toLegend: "A dónde se muda",
    toLabel: "Estado nuevo",
    holdLegend: "Lo que ya tiene",
    holdLead: "Marque los documentos que ya tiene. Déjelos sin marcar si no está seguro.",
    submitPlan: "Muéstreme el plan",
    sameStateError: "Elija dos estados distintos para poder mostrarle qué cambia.",

    planTitle: "Su plan de mudanza",
    planHeading: (from: string, to: string) => `Mudanza de ${from} a ${to}`,
    planIntro:
      "Cada paso viene de una fuente oficial, con la fecha en que lo verificamos por última vez. Los pasos están ordenados para que no se quede atascado: lo que es más fácil hacer antes de mudarse va primero.",

    phaseHave: "Lo que ya tiene",
    phaseHaveLead:
      "Usted nos dijo que ya tiene estos documentos. Aparecen aquí como referencia, y porque pasos posteriores se los piden.",
    phaseBefore: "Antes de mudarse",
    phaseBeforeLead:
      "Estos pasos siguen las reglas del estado que deja. Nuestra fuente para ese estado dice que el paso ocurre donde usted vive — así que esta vía está abierta ahora y puede no estarlo después.",
    phaseEither: "En cualquier momento",
    phaseEitherLead:
      "Estos son documentos federales. Las mismas reglas aplican en ambos estados, así que la mudanza no los cambia.",
    phaseBirth: "Dónde nació usted",
    phaseBirthLead:
      "Su acta de nacimiento la guarda el estado donde usted nació. La mudanza no cambia eso, así que tampoco cambia qué reglas aplican. No le preguntamos dónde nació, por eso abajo aparecen los dos estados de este plan. Si nació en otro estado, aplican las reglas de ese estado y todavía no lo cubrimos.",
    phaseAfter: "Después de llegar",
    phaseAfterLead: "Estos pasos siguen las reglas del estado al que se muda.",

    classCarriesOver: "Federal — la mudanza no cambia esto",
    classRedo: "El estado nuevo tiene sus propios requisitos",
    classDoInOrigin: "Se hace bajo las reglas del estado que usted deja",
    classKeep: "Usted ya tiene esto",
    classBirthState: "Lo maneja el estado donde usted nació — la mudanza no cambia esto",
    classUnknown: "Todavía no tenemos una fuente verificada para esto",
    keepUnknownNote:
      "Este documento lo emitió el estado que usted deja. Nuestras fuentes no dicen qué hace el estado nuevo con un documento emitido en otro lugar, así que no vamos a adivinar. Consulte la fuente del paso que se lo pida.",
    alternativeRoute: (n: number) => `Esta es una de dos vías para el mismo documento. Haga esta o el paso ${n} — no ambas.`,

    hazardsHeading: "El orden importa",
    hazardPrereq: (step: string, blocker: string) =>
      `«${step}» le pide traer el resultado de «${blocker}». Haga ese primero, o pueden rechazarle el trámite.`,
    hazardOriginWindow:
      "La fuente del estado que deja dice que este paso ocurre donde usted vive. Si se muda primero, es probable que tenga que empezarlo de nuevo bajo las reglas del estado nuevo.",
    hazardUnverified:
      "Al menos una regla detrás de este paso cambió hace poco, o nuestra verificación está vencida. No la mostraremos como vigente. Lea la fuente oficial antes de actuar en este paso.",
    hazardCreatesRecord:
      "Solicitar un trámite ante una agencia del gobierno crea un registro gubernamental de su solicitud. Eso pasa con cualquier solicitud, y conviene decidirlo a propósito, no por accidente.",

    costHeading: "Cuánto cuesta esto",
    costFloor: (amt: number) => `Tarifas que nuestras fuentes indican: $${amt}.`,
    costNothingPriced: "Nuestras fuentes no indican una tarifa para ningún paso de este plan.",
    costVariable: (n: number) => `${n} paso(s) tienen una tarifa que varía (por ejemplo, según el condado). No la estimamos.`,
    costUnpriced: (n: number) =>
      `${n} paso(s) no tienen ninguna tarifa indicada en nuestras fuentes. Considere el total como incompleto.`,
    costWaiver: "Hay una exención de tarifa documentada para al menos un paso. Búsquela en el paso más abajo.",
    costPotentiallyWaivable: (amt: number) =>
      `De ese mínimo, $${amt} se puede exentar potencialmente — pasos con un proceso de exención de tarifa documentado. "Potencialmente" describe la tarifa, no sus probabilidades; vea cada paso para el formulario y los criterios que publica la corte.`,
    costHonesty:
      "Esto es un mínimo, no un total. Solo sumamos las tarifas que nuestras fuentes indican, y decimos cuándo no podemos calcular un paso en vez de adivinar.",

    gapsHeading: "Lo que no pudimos cubrir",
    gapNoDestinationRecords: (state: string) =>
      `Todavía no tenemos una fuente verificada para este documento en ${state}.`,
    noStepsLead:
      "Todavía no pudimos crear un plan verificado para ese par de estados. Consulte las fuentes oficiales directamente.",
    planCta: "Planifique una mudanza a otro estado",
  },

  // Tabla de comparación "¿Qué estado?". Solo etiquetas estructurales de estado +
  // definiciones en lenguaje sencillo — vea CompareMessages sobre por qué nada aquí
  // puede clasificar un estado.
  compare: {
    formTitle: "Comparar estados",
    formHeading: "¿Qué estados tienen una vía documentada?",
    formLead:
      "Elija lo que necesita actualizar y le mostraremos, para cada estado, si una fuente oficial describe una manera de hacerlo, si esa fuente dice que no hay manera, o si todavía no lo hemos verificado.",
    currentLegend: "Su estado actual (opcional)",
    currentBlankOption: "No especificado",
    submit: "Comparar estados",
    cta: "Comparar estados uno al lado del otro",

    resultsTitle: "Comparación de estados",
    resultsHeading: "¿Qué estados tienen una vía documentada?",
    resultsIntro:
      "Para cada estado abajo, cada columna muestra lo que dicen nuestras fuentes sobre el documento y el cambio indicados en su encabezado. Lea «Cómo leer esta tabla» antes de confiar en cualquier celda — los cuatro estados significan cosas distintas, y dos de ellos son ausencias que es fácil confundir entre sí.",
    caption: "Vías documentadas por estado para los documentos y cambios seleccionados arriba.",
    columnState: "Estado",
    currentMarker: "su estado actual",

    statusDocumented: "Documentado",
    statusNeedsReverification: "Documentado, necesita reverificación",
    statusNoPath: "Ninguna vía documentada",
    statusNotCovered: "No verificado",
    legendHeading: "Cómo leer esta tabla",
    legendDocumented: "Documentado: una fuente oficial que citamos describe una manera de hacer esto.",
    legendNeedsReverification:
      "Documentado, necesita reverificación: una fuente oficial describe una manera de hacer esto, pero nuestra verificación está vencida, así que no la mostramos como vigente hasta volver a verificarla.",
    legendNoPath:
      "Ninguna vía documentada: una fuente oficial que citamos dice que no describe ninguna manera de hacer esto. Eso es un hecho sobre la fuente, no una prueba de que no exista ninguna manera en ningún lugar — lea la fuente usted mismo antes de confiar en ella.",
    legendNotCovered:
      "No verificado: todavía no hemos revisado una fuente oficial para esto. Esto no es una señal de que el estado no le exija nada — simplemente no lo hemos revisado.",

    sortLabel: "Ordenar:",
    sortAlpha: "Alfabético",
    sortCount: "Número de vías documentadas",
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
    methodologyTitle: "Cómo obtenemos y verificamos la información",
    transparencyTitle: "Informe de transparencia",
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
          '<p>El servicio minimiza los registros: no tiene cuentas ni una base de datos de perfiles de identidad, aunque las páginas generadas por el servidor requieren datos de la solicitud y crean registros operativos limitados. Consulte el <a href="/privacy?language=es">Aviso de privacidad</a> para conocer los límites exactos.</p>',
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
          "<p>El servicio no tiene cuentas ni una base de datos de perfiles de usuarios. Los datos de identidad ingresados en la herramienta para formularios permanecen en su dispositivo. Para mostrar una lista o respuesta, el navegador envía al servidor las selecciones de la dirección de la página y cualquier pregunta opcional de texto libre. <strong>No incluya su nombre, número de Seguro Social ni otros datos identificativos en una pregunta.</strong></p>",
      },
      {
        h: "Datos de identidad usados para formularios",
        html:
          "<p>La herramienta de formularios en el dispositivo no transmite su nombre, fecha de nacimiento, número de Seguro Social ni datos de documentos de identidad. Ese límite local no se aplica a la pregunta opcional: la pregunta se envía al servidor tal como se escribe.</p>",
      },
      {
        h: "Lo que procesa el servidor",
        html:
          "<p>El servidor lee de forma transitoria el estado, los cambios y documentos elegidos, el idioma, la opción administrativa sobre una orden judicial y cualquier pregunta opcional de la URL. Las preguntas de texto libre no entran en la caché de la aplicación ni se copian en los registros o respuestas de la aplicación. Las listas y respuestas basadas solo en selecciones pueden permanecer en una caché limitada en memoria hasta su eliminación o el reinicio del proceso. Como son URLs GET, la dirección completa también puede quedar en el historial del navegador o en registros de acceso del proveedor de infraestructura.</p>",
      },
      {
        h: "Registros de la aplicación y la infraestructura",
        html:
          "<p>Los registros de la aplicación usan una lista fija: plantilla de ruta, estado de respuesta, jurisdicción, tipos de cambio y documento elegidos, idioma y otros campos operativos limitados. Excluyen la pregunta sin procesar y los campos de identidad del formulario. La vista previa conserva esos registros durante 14 días; la plantilla de producción usa 30 días. Los proveedores de alojamiento y red pueden mantener metadatos separados según sus propias políticas.</p>",
      },
      {
        h: "Sin cookies, sin rastreadores",
        html: "<p>El servicio no usa rastreadores de publicidad ni de analítica, y no coloca cookies de seguimiento.</p>",
      },
      {
        h: "“Guardar su progreso” (opcional, en su dispositivo)",
        html:
          "<p>Si elige guardar su progreso, solo sus <em>selecciones</em>, nunca su nombre, se cifran con una contraseña que usted elige y se guardan en su propio dispositivo. La acción de guardar no transmite el contenido cifrado; las selecciones ya se enviaron en la solicitud de la página, como se explicó arriba. Puede eliminar el contenido local con “Eliminar lo guardado” o borrando el almacenamiento del navegador.</p>",
      },
      {
        h: "Opcional \"Guardar sin conexion\" (en su dispositivo)",
        html:
          "<p>Si elige guardar páginas para uso sin conexión, el navegador hace solicitudes explícitas al mismo origen para las páginas indicadas y los archivos necesarios; esas URLs y sus metadatos se procesan como se explicó arriba. Las copias resultantes se guardan <strong>sin cifrar</strong> en el navegador de su dispositivo. Cualquiera que pueda abrir el navegador o inspeccionar el dispositivo podría leerlas. Después de esa descarga iniciada por usted, la función no hace sincronización en segundo plano, notificaciones push ni descargas periódicas. Abrir una copia mientras está sin conexión no hace una nueva solicitud. Use “Eliminar copias sin conexión” (o borre el almacenamiento del navegador) cuando termine. Cada página muestra su fecha de guardado porque las leyes cambian.</p>",
      },
      {
        h: "Por qué lo hicimos así",
        html:
          "<p>Suponemos que algunas personas que lo usan pueden estar en lugares hostiles hacia las personas trans. Por eso el servicio evita cuentas y bases de datos de identidad, mantiene los datos de formularios en el dispositivo, impide que las preguntas sin procesar entren en los registros o la caché de la aplicación y limita la retención de registros. Esto reduce los datos; no significa que no pueda existir ningún registro del servidor o la infraestructura.</p>",
      },
      {
        h: "Sus opciones",
        html:
          "<p>Puede eliminar en cualquier momento el estado cifrado de reanudación y las copias sin conexión de su dispositivo. El servicio no tiene cuentas ni una base de datos de perfiles. Las entradas de la caché en memoria desaparecen al eliminarse o reiniciarse el proceso, los registros de la aplicación siguen los plazos anteriores y los proveedores de infraestructura pueden conservar registros separados fuera del control de esta aplicación.</p>",
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
    methodology: [
      {
        h: "Solo fuentes oficiales",
        html:
          "<p>Cada requisito que mostramos — una tarifa, un formulario, un tiempo de espera, el orden de los pasos — proviene de una <strong>fuente oficial del gobierno</strong>: un tribunal, una agencia estatal (DMV, registro civil), la Administración del Seguro Social o el Departamento de Estado de EE. UU. No nos basamos en foros, resúmenes de segunda mano ni otros sitios de defensoría como fuente principal, aunque podemos enlazar a una guía de ayuda legal para contexto adicional.</p>",
      },
      {
        h: "Cómo verificamos un requisito",
        // PENDING native-speaker review (no attestation) — honesty-status copy added 2026-07-11.
        html:
          "<p>Antes de que un dato entre al corpus, un revisor lee la fuente oficial directamente, registra la página o el documento exacto de donde proviene y anota la fecha en que se verificó. Esa URL de origen y esa fecha acompañan al dato dondequiera que se muestre — en una guía, un paso de la lista o una respuesta generada — para que pueda comprobar nuestro trabajo. <strong>Estado actual:</strong> esto es una vista previa de demostración. La verificación independiente por personas identificadas del corpus inicial sigue en curso, y todavía no se presenta ninguna jurisdicción como verificada por completo.</p>",
      },
      {
        h: "“Última verificación” y la vigencia de la información",
        html:
          "<p>Cada requisito lleva la fecha en que lo verificamos por última vez y una fecha límite de reverificación (su plazo de vigencia). Si un requisito supera ese plazo antes de que lo hayamos reverificado, dejamos de mostrarlo como vigente: se marca automáticamente como <strong>necesita reverificación</strong> y se señala en la interfaz, en lugar de quedar obsoleto sin aviso.</p>",
      },
      {
        h: "Informe un error o un cambio en la ley",
        html:
          "<p>Las leyes cambian más rápido de lo que un equipo pequeño puede seguir por sí solo. Si nota que un requisito está desactualizado o es incorrecto, abra un problema en el repositorio del proyecto usando la plantilla de informe “la ley cambió”. Tratamos un requisito incorrecto como un error, y priorizamos corregirlo antes que agregar funciones nuevas.</p>",
      },
      {
        h: "Ritmo de revisión con socios",
        // PENDING native-speaker review (no attestation) — honesty-status copy added 2026-07-11.
        html:
          "<p>Además de los informes individuales, nuestro modelo de trabajo previsto es una <strong>revisión trimestral</strong> permanente de los requisitos de cada jurisdicción con socios de ayuda legal para personas trans: cada trimestre, una organización socia (o un revisor voluntario identificado) vuelve a verificar las fuentes oficiales de esa jurisdicción frente a lo que publicamos; las correcciones se aplican de inmediato, se les asigna una nueva fecha y, cuando el cambio es sustancial, se anotan en el historial de versiones del proyecto. <strong>Este ritmo aún no está establecido:</strong> hoy no hay organizaciones socias incorporadas y todavía no se ha realizado ningún ciclo de revisión trimestral. Hasta que una jurisdicción tenga un revisor asignado y una revisión completada, se marca como tal en lugar de presentarse como revisada por socios.</p>",
      },
    ],
  },

  transparency: [
    {
      h: "Sobre este informe",
      html:
        "<p>La minimización de datos es un compromiso de arquitectura, no una afirmación de que el servicio no tenga contacto con un servidor. Esta página trimestral resume qué registros puede crear la compilación de referencia y qué permanece en el dispositivo; consulte el <a href=\"/privacy?language=es\">Aviso de privacidad</a> para conocer el límite completo.</p>" +
        "<p><strong>Este no es un informe de estadísticas sobre solicitudes legales y no incluye un “warrant canary”.</strong> Cualquier declaración sobre solicitudes recibidas, divulgaciones realizadas o el estado de un canary requiere revisión por un abogado con licencia, que sigue siendo un requisito de lanzamiento explícito y <strong>pendiente</strong> (vea los <a href=\"/terms?language=es\">Términos de uso</a>). No debe inferirse ningún estado de canary —presente o ausente— de esta página.</p>",
    },
    {
      h: "Resumen de arquitectura del 2.º trimestre de 2026 (revisado el 12 de julio de 2026)",
      html:
        "<p>Este es un inventario del código y la infraestructura de la compilación de referencia, no una declaración sobre solicitudes legales de producción. Según <code>docs/audits/dpia.md</code>:</p>" +
        "<p><strong>Registros que pueden existir:</strong> URLs de solicitud con selecciones de la lista y una pregunta opcional; entradas limitadas en memoria para páginas basadas solo en selecciones; registros de la aplicación con metadatos de ruta y selección (14 días en la vista previa, 30 en la plantilla de producción); y metadatos de red, cuenta o acceso del proveedor según su propia retención. La pregunta sin procesar no entra en la caché, los registros ni la respuesta de la aplicación, pero una URL GET completa puede aparecer en el historial del navegador o en registros de acceso externos.</p>" +
        "<p><strong>Límites del almacenamiento local:</strong> la herramienta de formularios no transmite los datos de identidad ingresados y la función de reanudación no transmite su contenido cifrado. “Guardar sin conexión” sí solicita explícitamente al mismo origen las páginas indicadas y los archivos necesarios, y luego conserva las copias sin cifrar en el navegador; no hace sincronización en segundo plano. Nada de esto afirma de forma absoluta qué registros mantienen los proveedores; no incluya datos identificativos en una pregunta opcional.</p>",
    },
  ],

  seo: {
    homeTitle: "Guía de cambio de nombre y marcador de género, por estado",
    homeDescription:
      "Pasos claros y citados para cambiar su nombre legal y marcador de género en EE. UU., con los formularios y fuentes oficiales de su estado. No es asesoramiento legal.",
    compareDescription:
      "Vea, estado por estado, si una fuente oficial describe una manera de actualizar su nombre o marcador de género, dice que no hay manera, o si no se ha revisado.",
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
    breadcrumbNav: "Ruta de navegación",
    legalDescription: {
      terms: "Los términos para usar Trans Docs Navigator: información general, no asesoramiento legal, sin garantía. Verifique cada requisito con la fuente oficial.",
      privacy: "Cómo Trans Docs Navigator procesa selecciones y preguntas en el servidor, mantiene los datos de formularios en el dispositivo y limita sus registros.",
      accessibility: "Nuestro compromiso de accesibilidad WCAG 2.2 AA para Trans Docs Navigator, lo que probamos automáticamente y cómo informar una barrera.",
      methodology: "Cómo Trans Docs Navigator obtiene y verifica cada requisito de fuentes oficiales del gobierno, más el ritmo trimestral de revisión con socios que estamos estableciendo.",
    },
    transparencyDescription:
      "Entradas trimestrales sobre lo que Trans Docs Navigator podría y no podría producir ante una solicitud legal. Sin warrant canary: revisión legal pendiente.",

    feedIndexTitle: "Reciba avisos cuando cambien los registros de un estado (RSS)",
    feedIndexDescription:
      "Suscríbase por RSS o Atom a las actualizaciones de los registros de cambio de nombre y marcador de género. Sin cuenta, sin correo, sin rastreo.",
    feedIndexLead:
      "Elija un estado para obtener el enlace de su feed. Cada feed le indica cuándo actualizamos nuestros propios registros de ese estado — nunca una afirmación de que la ley misma cambió.",
    feedIndexAllHeading: "Todos los feeds por estado",
    feedLinkLabel: (state: string) => `Reciba avisos cuando actualicemos los registros de ${state} (RSS)`,
    feedChannelTitle: (state: string) => `${state}: registros actualizados`,
    feedChannelDescription: (state: string) =>
      `Avisos cuando Trans Docs Navigator actualiza sus propios registros citados para ${state} — nunca un aviso de que la ley misma cambió. Suscríbase con cualquier lector de RSS o Atom. No hay cuenta, no se pide correo electrónico y no se recopila nada sobre usted para entregar este feed.`,
    feedEntryTitle: (count: number, state: string, date: string) =>
      `${count} registro${count === 1 ? "" : "s"} de ${state} actualizado${count === 1 ? "" : "s"} el ${date}`,
    feedEntryDescription: (count: number, state: string, date: string, docTypes: string) =>
      `(Re)verificamos ${count} registro${count === 1 ? "" : "s"} de ${state} el ${date}, sobre: ${docTypes}. Esto significa que nuestros registros cambiaron — no necesariamente la ley. Confirme siempre con la fuente oficial enlazada en cada paso.`,
    feedEntryDegradedNote:
      "Al menos uno de estos registros necesita reverificación actualmente y no se muestra como vigente en el resto del sitio.",
    feedEmptyNote: "Todavía no tenemos registros con fecha para esta jurisdicción en este idioma.",
  },
};
