import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-16 text-center">
      <p className="text-sm text-ink-2">Error 404</p>
      <h1 className="mt-1 text-2xl font-semibold text-ink">
        Esta página no existe
      </h1>
      <Link
        href="/"
        className="mt-4 inline-block text-sm font-medium text-accent-text hover:underline"
      >
        Volver al inicio
      </Link>
    </div>
  );
}
