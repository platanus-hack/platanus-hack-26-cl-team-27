import { PageHeader } from '@team27/ui';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Privacidad' };

const CONTACT = 'appvigente@gmail.com';

const sections: readonly { title: string; body: readonly string[] }[] = [
  {
    title: 'Qué leemos',
    body: [
      'Si conectas tu cuenta de Google, leemos tu correo para mostrarte con qué cuenta entraste, y solo las planillas que tú vinculas a un proyecto, en modo lectura.',
      'Con el permiso de metadatos de Google Drive sabemos cuándo cambió una planilla vinculada y quién la editó por última vez. No leemos el contenido de otros archivos de tu Drive.',
      'Si tu organización conecta su cuenta de Autodesk, recibimos los avisos de cambios de sus carpetas y modelos: qué archivo cambió, cuándo y quién lo hizo.',
    ],
  },
  {
    title: 'Qué guardamos',
    body: [
      'De Google guardamos el permiso (el token de actualización) cifrado y, de cada planilla vinculada, una huella (hash) y la fecha de su última revisión, y el último cambio con su autor. El contenido de la última revisión queda solo en la memoria del servidor mientras corre, para compararlo con la siguiente.',
      'De Autodesk guardamos el permiso de tu organización (los tokens de acceso y de actualización) cifrado, el id, correo y nombre de la cuenta de Autodesk que lo conectó, los permisos otorgados, y cada aviso recibido para no procesarlo dos veces.',
      'Los registros técnicos del servidor anotan cada cambio detectado: en planillas, hasta 10 celdas con su valor anterior y nuevo y quién las editó; en Autodesk, el nombre del archivo y el id del usuario que lo cambió.',
    ],
  },
  {
    title: 'Para qué lo usamos',
    body: [
      'Solo para avisar a los equipos de tu proyecto qué cambió y a quién afecta. No vendemos ni compartimos tus datos, y no los usamos para publicidad.',
    ],
  },
  {
    title: 'Cómo lo borras',
    body: [
      'En Conectores puedes desvincular cada planilla y desconectar tu cuenta de Google cuando quieras: dejamos de leer y borramos el permiso guardado. También puedes quitar el acceso desde tu cuenta de Google, en Seguridad y acceso.',
      'Si eres administrador, en Tu cuenta (/cuenta) puedes desconectar la cuenta de Autodesk de tu organización: revocamos el permiso en Autodesk y borramos lo guardado.',
      `Si quieres que borremos todo lo que guardamos de ti, escríbenos a ${CONTACT}.`,
    ],
  },
];

export default function PrivacyPage() {
  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Privacidad"
        description="Qué datos usa Vigente cuando conectas Google Sheets o Autodesk, y cómo los controlas."
      />
      <div className="mt-6 space-y-6">
        {sections.map((section) => (
          <section key={section.title}>
            <h2 className="text-base font-semibold text-ink">
              {section.title}
            </h2>
            {section.body.map((paragraph) => (
              <p key={paragraph} className="mt-2 text-sm text-ink-2">
                {paragraph}
              </p>
            ))}
          </section>
        ))}
        <p className="text-sm text-ink-2">
          Contacto:{' '}
          <a
            href={`mailto:${CONTACT}`}
            className="font-medium text-accent-text hover:underline"
          >
            {CONTACT}
          </a>
        </p>
      </div>
    </div>
  );
}
