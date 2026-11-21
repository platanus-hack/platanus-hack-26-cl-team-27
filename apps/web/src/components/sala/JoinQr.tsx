'use client';

import { QRCodeSVG } from 'qrcode.react';
import { useSyncExternalStore } from 'react';

const subscribe = () => () => undefined;
const origin = () => `${window.location.origin}/`;
const serverOrigin = () => '';

export function JoinQr() {
  const url = useSyncExternalStore(subscribe, origin, serverOrigin);
  return (
    <div className="flex items-center gap-4">
      {url ? (
        <div className="shrink-0 rounded-lg bg-white p-2">
          <QRCodeSVG
            value={url}
            size={96}
            level="M"
            bgColor="#ffffff"
            fgColor="#000000"
          />
        </div>
      ) : (
        <div className="size-28 shrink-0 rounded-lg bg-surface-2" />
      )}
      <div className="min-w-0">
        <p className="text-sm font-semibold text-ink">Súmate con tu celular</p>
        <p className="text-sm text-ink-2">Escanea, elige un asiento y vota.</p>
        <p className="mt-1 break-all text-sm font-medium text-ink">
          {url || ' '}
        </p>
      </div>
    </div>
  );
}
