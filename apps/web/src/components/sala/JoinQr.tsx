'use client';

import { QRCodeSVG } from 'qrcode.react';
import { useSyncExternalStore } from 'react';

const subscribe = () => () => undefined;
const origin = () => `${window.location.origin}/`;
const serverOrigin = () => '';

export function JoinQr() {
  const url = useSyncExternalStore(subscribe, origin, serverOrigin);
  return (
    <section className="rounded-xl border border-hairline bg-surface p-5">
      <h2 className="text-2xl font-semibold text-ink">Súmate con tu celular</h2>
      <div className="mt-3 flex flex-col items-center gap-3">
        {url ? (
          <div className="rounded-xl bg-white p-3">
            <QRCodeSVG
              value={url}
              size={208}
              level="M"
              bgColor="#ffffff"
              fgColor="#000000"
            />
          </div>
        ) : (
          <div className="size-[232px] rounded-xl bg-surface-2" />
        )}
        <p className="break-all text-center text-xl font-medium text-ink">
          {url || ' '}
        </p>
        <p className="text-center text-lg text-ink-2">
          Escanea, elige un asiento y vota.
        </p>
      </div>
    </section>
  );
}
