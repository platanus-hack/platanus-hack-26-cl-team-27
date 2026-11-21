import { Icon } from '@/components/common/Icon';
import type { Seal } from '@/lib/room-api';

export function SealBanner({ seal }: { readonly seal: Seal }) {
  return (
    <section
      role="status"
      className="flex flex-wrap items-start gap-4 rounded-xl border-2 border-good bg-good/10 px-5 py-4"
    >
      <Icon name="seal" filled className="size-12 text-good" />
      <div className="min-w-0 flex-1">
        <h2 className="text-2xl font-semibold tracking-tight text-ink">
          Obra consensuada · Versión {seal.version}
        </h2>
        <p className="text-sm text-ink-2">
          Todos los documentos están al día y no queda nada en disputa.
        </p>
        {seal.lines.length > 0 && (
          <ul className="mt-2 flex flex-col gap-0.5 text-sm text-ink">
            {seal.lines.map((line) => (
              <li key={line} className="flex items-start gap-2">
                <Icon name="check" className="mt-0.5 text-good" />
                {line}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
