import { cx } from '@team27/ui';

const PATHS = {
  check: 'M3.5 8.5 6.5 11.5 12.5 4.5',
  alert: 'M8 3.5v5.5M8 11.6v.4',
  hourglass:
    'M4.5 3h7M4.5 13h7M5 3c0 3 3 3.5 3 5s-3 2-3 5M11 3c0 3-3 3.5-3 5s3 2 3 5',
  minus: 'M4.5 8h7',
  dot: 'M8 8v.01',
  file: 'M4.5 2.5h5l2.5 2.5v8.5h-7.5zM9.5 2.5V5H12',
  bell: 'M4.5 11V7.5a3.5 3.5 0 0 1 7 0V11l1 1.5h-9zM6.8 14h2.4',
  user: 'M8 8a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM3 13.5c.5-2.4 2.3-3.5 5-3.5s4.5 1.1 5 3.5',
  upload: 'M8 11V3.5M5 6.2 8 3.2l3 3M3.5 12.5h9',
  arrow: 'M3.5 8h9M9 4.5 12.5 8 9 11.5',
  lock: 'M4.5 7.5h7v5.5h-7zM5.8 7.5V5.8a2.2 2.2 0 0 1 4.4 0v1.7',
  wifiOff:
    'M3 6.5a7.5 7.5 0 0 1 10 0M5.5 9a4 4 0 0 1 5 0M8 11.8v.2M2.5 2.5l11 11',
  seal: 'M8 1.8 9.7 3l2.1-.1.6 2 1.7 1.3-.6 2 .6 2-1.7 1.3-.6 2-2.1-.1L8 14.2 6.3 13l-2.1.1-.6-2L1.9 9.8l.6-2-.6-2 1.7-1.3.6-2 2.1.1zM5.6 8.2l1.7 1.7 3.2-3.4',
  ban: 'M8 2.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11zM4.2 4.2l7.6 7.6',
} as const;

export type IconName = keyof typeof PATHS;

export interface IconProps {
  readonly name: IconName;
  readonly className?: string;
  readonly filled?: boolean;
}

export function Icon({ name, className, filled = false }: IconProps) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 16 16"
      className={cx('size-4 shrink-0', className)}
    >
      {filled && (
        <circle cx="8" cy="8" r="7.5" fill="currentColor" opacity="0.16" />
      )}
      <path
        d={PATHS[name]}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
