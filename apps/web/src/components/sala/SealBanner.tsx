import { Icon } from '@/components/common/Icon';
import type { Seal } from '@/lib/room-api';

export function SealBanner({ seal }: { readonly seal: Seal }) {
  return (
    <section
      role="status"
      className="flex flex-wrap items-center gap-6 rounded-2xl border-4 border-good bg-good/15 p-6"
    >
      <Icon name="seal" filled className="size-20 text-good" />
      <div className="min-w-0 flex-1">
        <h2 className="text-5xl font-semibold tracking-tight text-ink">
          Obra consensuada
        </h2>
        <p className="mt-1 text-2xl text-ink">
          Versión {seal.version} del proyecto
        </p>
        {seal.lines.length > 0 && (
          <ul className="mt-2 flex flex-col gap-0.5 text-xl text-ink-2">
            {seal.lines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
