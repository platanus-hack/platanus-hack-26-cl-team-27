export function ConsensusRing({
  upToDate,
  documents,
}: {
  readonly upToDate: number;
  readonly documents: number;
}) {
  const ratio = documents === 0 ? 0 : Math.min(1, upToDate / documents);
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  return (
    <div className="flex items-center gap-5">
      <svg
        viewBox="0 0 120 120"
        role="img"
        aria-label={`${upToDate} de ${documents} documentos al día`}
        className="size-36 shrink-0"
      >
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke="var(--color-grid)"
          strokeWidth="12"
        />
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke="var(--color-good)"
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - ratio)}
          transform="rotate(-90 60 60)"
          className="transition-[stroke-dashoffset] duration-700"
        />
        <text
          x="60"
          y="66"
          textAnchor="middle"
          className="fill-ink text-[28px] font-semibold"
        >
          {upToDate}/{documents}
        </text>
      </svg>
      <p className="text-xl text-ink-2">
        <span className="block text-3xl font-semibold text-ink">
          {upToDate} de {documents}
        </span>
        documentos al día
      </p>
    </div>
  );
}
