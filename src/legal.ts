// Legal & policy pages: Terms of Use, Privacy Notice, Accessibility Statement.
// Served at /terms, /privacy, /accessibility and linked from every page footer.
//
// PLAIN LANGUAGE by design (these are read by the same audience as the rest of the site).
// DRAFT POSTURE: this is a pre-launch reference build. The Terms and Privacy text are
// written to be honest and reasonable but are NOT a substitute for review by a licensed
// attorney — counsel review of the disclaimers/terms is an explicit, OPEN launch gate
// (docs/STATUS.md §7.1). Do not present this as final legal text without that review.

import type { Language } from "../api/types.ts";
import { page, escapeHtml } from "./render.ts";

export const LEGAL_EFFECTIVE_DATE = "2026-06-05";

interface Section {
  h: string;
  /** Static, trusted HTML (paragraphs/links). No user input is interpolated here. */
  html: string;
}

function legalBody(sections: Section[], lang: Language, updatedLabel: string): string {
  const body = sections.map((s) => `<section><h2>${escapeHtml(s.h)}</h2>${s.html}</section>`).join("\n");
  return `${body}\n<p class="meta">${escapeHtml(updatedLabel)} ${escapeHtml(LEGAL_EFFECTIVE_DATE)}.</p>`;
}

const UPDATED = { en: "Last updated:", es: "Última actualización:" } as const;
const TITLES = {
  terms: { en: "Terms of Use", es: "Términos de uso" },
  privacy: { en: "Privacy Notice", es: "Aviso de privacidad" },
  accessibility: { en: "Accessibility Statement", es: "Declaración de accesibilidad" },
} as const;

// ── Terms of Use ──────────────────────────────────────────────────────────────
const TERMS: Record<Language, Section[]> = {
  en: [
    {
      h: "Information, not legal advice",
      html:
        "<p>Trans Docs Navigator gives you general, public information to help you understand the steps for a legal name or gender-marker change. It is <strong>not legal advice</strong>, it is not a substitute for a lawyer, and using it does not create an attorney–client relationship. For advice about your specific situation, talk to a licensed attorney or a trans legal-aid organization.</p>",
    },
    {
      h: "We don't guarantee accuracy — verify before you act",
      html:
        "<p>Laws, forms, fees, and timelines change, and they differ by court and county. We cite an official source and the date we last checked it for every requirement, but <strong>you must confirm the current rule with the official source before you act or file</strong>. The Service is provided “as is,” without warranties of any kind.</p>",
    },
    {
      h: "Not a filing service",
      html:
        "<p>The Service does not submit anything to any court or agency for you. Any forms it helps you fill are filled on your own device, and <strong>you are responsible</strong> for reviewing, completing, and filing them yourself.</p>",
    },
    {
      h: "Limitation of liability",
      html:
        "<p>To the fullest extent permitted by law, the project and its contributors are not liable for any loss or harm arising from your use of, or reliance on, the Service or its content. <em>(This section is subject to review by counsel before public launch.)</em></p>",
    },
    {
      h: "Your responsibilities",
      html:
        "<p>Use the information lawfully and for your own purposes. Confirm every requirement against the official source, and seek professional advice where your situation is uncertain or high-stakes.</p>",
    },
    {
      h: "Privacy",
      html:
        '<p>The Service is built to collect essentially nothing about you. See the <a href="/privacy">Privacy Notice</a> for details.</p>',
    },
    {
      h: "Content and licensing",
      html:
        "<p>Government forms and texts are generally public; we record where each fact comes from. The Service's source code is licensed under AGPL-3.0. You may not present the Service as official, government, or legal-professional advice.</p>",
    },
    {
      h: "Changes to these terms",
      html: "<p>We may update these Terms. When we do, the “last updated” date below changes. Continued use means you accept the current version.</p>",
    },
  ],
  es: [
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
};

// ── Privacy Notice ────────────────────────────────────────────────────────────
const PRIVACY: Record<Language, Section[]> = {
  en: [
    {
      h: "The short version",
      html:
        "<p>We designed this Service to collect essentially nothing about you. You don't need an account. Your answers stay in your browser. Forms are filled on your device. <strong>Nothing you type is sent to or stored on our servers.</strong></p>",
    },
    {
      h: "What we never receive",
      html:
        "<p>Your name, date of birth, Social Security number, and any identity-document data are <strong>never sent to a server</strong>. Form pre-fill happens entirely in your browser.</p>",
    },
    {
      h: "What is processed to show your checklist",
      html:
        "<p>To build your checklist, the Service reads only non-identifying choices from the web address — your state, the document types you picked, and your language. These are not linked to you as a person.</p>",
    },
    {
      h: "Server logs",
      html:
        "<p>Our server keeps minimal technical logs limited to a fixed allowlist of non-identifying fields (for example: which page, the response status, and a jurisdiction code). No identifying information is logged, by design.</p>",
    },
    {
      h: "No cookies, no trackers",
      html: "<p>The Service uses no advertising or analytics trackers and sets no tracking cookies.</p>",
    },
    {
      h: "Optional “Save your progress” (on your device)",
      html:
        "<p>If you choose to save your progress, only your <em>selections</em> — never your name — are encrypted with a passphrase you choose and stored on your own device. They are never sent anywhere, and you can delete them at any time with the “Delete saved” button or by clearing your browser storage.</p>",
    },
    {
      h: "Why we built it this way",
      html:
        "<p>We assume some people who use this may be in places that are hostile to trans people. The strongest protection is to have nothing to hand over, so the Service is built to hold nothing about you.</p>",
    },
    {
      h: "Your choices",
      html:
        "<p>Because we store nothing about you on our servers, there is nothing for us to delete or disclose on request. You remain in control of any data saved locally on your device.</p>",
    },
  ],
  es: [
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
        "<p>Si elige guardar su progreso, solo sus <em>selecciones</em> — nunca su nombre — se cifran con una contraseña que usted elige y se guardan en su propio dispositivo. Nunca se envían a ningún lugar, y puede eliminarlas en cualquier momento con el botón “Eliminar lo guardado” o borrando el almacenamiento de su navegador.</p>",
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
};

// ── Accessibility Statement ───────────────────────────────────────────────────
const ACCESSIBILITY: Record<Language, Section[]> = {
  en: [
    {
      h: "Our goal",
      html: "<p>We aim to meet <strong>WCAG 2.2 Level AA</strong>. Accessibility is a release requirement, not an afterthought.</p>",
    },
    {
      h: "What we do",
      html:
        "<ul><li>Semantic HTML with a skip link and labelled controls.</li><li>The core flow works with <strong>no JavaScript</strong>.</li><li>Keyboard-complete paths and always-visible focus.</li><li>Sufficient colour contrast, checked automatically on every change.</li><li>Reduced-motion support and a calm, low-stimulation default.</li><li>Readable at 200% zoom and on small screens.</li></ul>",
    },
    {
      h: "What is still in progress",
      html:
        "<p>A full manual screen-reader, keyboard-only, and zoom walkthrough is part of our release process and is being completed before public launch. Automated checks (axe/pa11y and colour contrast) run on every change.</p>",
    },
    {
      h: "Tell us about a barrier",
      html:
        '<p>If something is hard to use, please let us know by opening an issue on the project repository. We treat accessibility barriers as bugs.</p>',
    },
  ],
  es: [
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
        '<p>Si algo es difícil de usar, háganoslo saber abriendo un problema en el repositorio del proyecto. Tratamos las barreras de accesibilidad como errores.</p>',
    },
  ],
};

export function renderTermsPage(lang: Language = "en"): string {
  return page({ lang, title: TITLES.terms[lang], heading: TITLES.terms[lang], body: legalBody(TERMS[lang], lang, UPDATED[lang]) });
}
export function renderPrivacyPage(lang: Language = "en"): string {
  return page({ lang, title: TITLES.privacy[lang], heading: TITLES.privacy[lang], body: legalBody(PRIVACY[lang], lang, UPDATED[lang]) });
}
export function renderAccessibilityPage(lang: Language = "en"): string {
  return page({ lang, title: TITLES.accessibility[lang], heading: TITLES.accessibility[lang], body: legalBody(ACCESSIBILITY[lang], lang, UPDATED[lang]) });
}
