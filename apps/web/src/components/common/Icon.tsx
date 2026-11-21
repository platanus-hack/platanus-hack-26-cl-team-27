import { cx } from '@team27/ui';

const PATHS = {
  check: 'M3.5 8.5 6.5 11.5 12.5 4.5',
  alert: 'M8 3.5v5.5M8 11.6v.4',
  hourglass:
    'M4.5 3h7M4.5 13h7M5 3c0 3 3 3.5 3 5s-3 2-3 5M11 3c0 3-3 3.5-3 5s3 2 3 5',
  minus: 'M4.5 8h7',
  dot: 'M8 6.6a1.4 1.4 0 1 0 0 2.8 1.4 1.4 0 1 0 0-2.8z',
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
  chevron: 'M6 3.5 10.5 8 6 12.5',
  chevronDown: 'M3.5 6 8 10.5 12.5 6',
  close: 'M4 4l8 8M12 4l-8 8',
  dots: 'M3.3 8a.7.7 0 1 0 1.4 0 .7.7 0 1 0-1.4 0zM7.3 8a.7.7 0 1 0 1.4 0 .7.7 0 1 0-1.4 0zM11.3 8a.7.7 0 1 0 1.4 0 .7.7 0 1 0-1.4 0z',
  calendar: 'M3 4.5h10v8.5H3zM3 7.5h10M5.5 3v3M10.5 3v3',
  coins:
    'M8 2.8c2.8 0 5 .9 5 2s-2.2 2-5 2-5-.9-5-2 2.2-2 5-2zM3 4.8v3.1c0 1.1 2.2 2 5 2s5-.9 5-2V4.8M3 7.9V11c0 1.1 2.2 2 5 2s5-.9 5-2V7.9',
  folder: 'M2.5 4.5h4l1.5 1.5h5.5v6.5h-11z',
  mail: 'M2.5 4h11v8h-11zM2.5 4.5 8 9l5.5-4.5',
  chat: 'M3 3.5h10v7H7.2l-3.2 2.5v-2.5H3z',
  book: 'M3.5 2.5h8.5v11H3.5zM6 2.5v11',
  refresh: 'M12.5 8a4.5 4.5 0 1 1-1.3-3.2M12.5 3v2.5H10',
  external: 'M9 3h4v4M13 3 7.5 8.5M11 9.5V13H3V5h3.5',
  qr: 'M3 3h4v4H3zM9 3h4v4H9zM3 9h4v4H3zM9.5 9.5h1.2M12 9.5h1M9.5 12h1M12 12h1',
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
