'use client';

import { Button, Card, Notice } from '@team27/ui';
import { useState } from 'react';

import { StateMark } from '@/components/common/StateMark';
import { describeError, type Auth } from '@/lib/http';
import { playScene, type SceneView } from '@/lib/scenes-api';

const STATUS = {
  pending: { tone: 'neutral', icon: 'minus', label: 'Pendiente' },
  running: { tone: 'warning', icon: 'hourglass', label: 'En curso' },
  played: { tone: 'good', icon: 'check', label: 'Hecha' },
} as const;

function SceneRow({
  scene,
  busy,
  onPlay,
}: {
  readonly scene: SceneView;
  readonly busy: boolean;
  readonly onPlay: (scene: SceneView) => void;
}) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-hairline bg-surface-2 p-3">
      <div className="min-w-0 flex-1">
        <p className="text-base font-medium text-ink">{scene.label}</p>
        <p className="text-sm text-ink-2">{scene.hint}</p>
        {!scene.playable && scene.disabledReason && (
          <p className="text-sm text-ink">{scene.disabledReason}</p>
        )}
        <StateMark {...STATUS[scene.status]} className="mt-1" />
      </div>
      <Button disabled={!scene.playable || busy} onClick={() => onPlay(scene)}>
        {busy ? 'Reproduciendo…' : 'Reproducir'}
      </Button>
    </li>
  );
}

export function SceneList({
  scenes,
  auth,
  onDone,
}: {
  readonly scenes: readonly SceneView[];
  readonly auth: Auth;
  readonly onDone: () => void;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const play = async (scene: SceneView) => {
    setBusyId(scene.id);
    setError(null);
    try {
      await playScene(scene.id, auth);
      onDone();
    } catch (failure) {
      setError(describeError(failure));
    } finally {
      setBusyId(null);
    }
  };

  const main = scenes.filter((scene) => !scene.extra);
  const extras = scenes.filter((scene) => scene.extra);

  return (
    <Card title="Escenas" description="El guion, una a una.">
      <ul className="flex flex-col gap-2">
        {main.map((scene) => (
          <SceneRow
            key={scene.id}
            scene={scene}
            busy={busyId === scene.id}
            onPlay={(s) => void play(s)}
          />
        ))}
      </ul>
      {extras.length > 0 && (
        <>
          <h3 className="mt-4 mb-2 text-sm font-semibold text-ink">Extras</h3>
          <ul className="flex flex-col gap-2">
            {extras.map((scene) => (
              <SceneRow
                key={scene.id}
                scene={scene}
                busy={busyId === scene.id}
                onPlay={(s) => void play(s)}
              />
            ))}
          </ul>
        </>
      )}
      {error && (
        <div className="mt-3">
          <Notice tone="error">{error}</Notice>
        </div>
      )}
    </Card>
  );
}
