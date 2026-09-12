import PlaybookGuide from "./PlaybookGuide";

// Guía de prospección: qué mandarle por WhatsApp a los leads que salen del
// motor de búsquedas y cómo llevarlos hasta el cierre. Es contenido fijo, así
// que no necesita pedir nada a Supabase; el middleware ya exige sesión.
export const metadata = { title: "Guía de contacto" };

export default function GuiaPage() {
  return <PlaybookGuide />;
}
