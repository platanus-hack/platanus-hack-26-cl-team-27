'use client';

import { Button, Card, Field, Input, Notice, Select } from '@team27/ui';
import { type FormEvent, useState } from 'react';

import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { LoadError, Loading } from '@/components/common/LoadState';
import { useResource } from '@/hooks/use-resource';
import {
  addToTeam,
  getMembers,
  type ProjectTeam,
  removeFromTeam,
  teamCandidates,
  type TeamMember,
} from '@/lib/accounts-api';
import { describeError } from '@/lib/http';

export function TeamCard({
  projectId,
  organizationId,
  team,
  error,
  onChange,
}: {
  readonly projectId: string;
  readonly organizationId: string;
  readonly team: ProjectTeam | null;
  readonly error: string | null;
  readonly onChange: () => void;
}) {
  const [removing, setRemoving] = useState<TeamMember | null>(null);
  const [busy, setBusy] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);

  const confirmRemove = async () => {
    if (!removing) return;
    setBusy(true);
    setRemoveError(null);
    try {
      await removeFromTeam(projectId, removing.userId);
      setRemoving(null);
      onChange();
    } catch (failure) {
      setRemoveError(describeError(failure));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card
      title="Equipo del proyecto"
      description="Quienes reciben los avisos de los cambios y los responden."
    >
      {error && <LoadError message={error} />}
      {!team && !error && <Loading />}
      {team && (
        <ul className="flex flex-col divide-y divide-hairline">
          {team.members.map((member) => (
            <li
              key={member.userId}
              className="flex flex-wrap items-center justify-between gap-3 py-2.5"
            >
              <div className="min-w-0">
                <p className="text-ink">{member.name}</p>
                <p className="text-sm text-ink-2">
                  {member.role}
                  {member.email !== member.name ? ` · ${member.email}` : ''}
                </p>
              </div>
              {member.author ? (
                <span className="text-sm text-ink-2">Creó el proyecto</span>
              ) : (
                team.canManage && (
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => {
                      setRemoveError(null);
                      setRemoving(member);
                    }}
                  >
                    Quitar
                  </Button>
                )
              )}
            </li>
          ))}
        </ul>
      )}
      {team?.canManage && (
        <AddToTeamForm
          projectId={projectId}
          organizationId={organizationId}
          team={team}
          onAdded={onChange}
        />
      )}
      {removing && (
        <ConfirmDialog
          title={`¿Quitar a ${removing.name} del equipo?`}
          confirmLabel="Quitar"
          busyLabel="Quitando…"
          busy={busy}
          error={removeError}
          onConfirm={() => void confirmRemove()}
          onCancel={() => setRemoving(null)}
        >
          Deja de recibir los avisos de este proyecto. Sigue en la organización
          y puedes volver a sumarlo.
        </ConfirmDialog>
      )}
    </Card>
  );
}

function AddToTeamForm({
  projectId,
  organizationId,
  team,
  onAdded,
}: {
  readonly projectId: string;
  readonly organizationId: string;
  readonly team: ProjectTeam;
  readonly onAdded: () => void;
}) {
  const members = useResource(
    (signal) => getMembers(organizationId, signal),
    organizationId,
  );
  const [userId, setUserId] = useState('');
  const [role, setRole] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (members.error) return <LoadError message={members.error} />;
  if (!members.data) return null;
  const candidates = teamCandidates(members.data.members, team.members);
  if (candidates.length === 0) {
    return (
      <p className="mt-4 border-t border-hairline pt-4 text-sm text-ink-2">
        Toda la organización ya está en el equipo. Para sumar a alguien más,
        invítalo primero a la organización desde Cuenta.
      </p>
    );
  }
  const selected = candidates.some((item) => item.userId === userId)
    ? userId
    : (candidates[0]?.userId ?? '');

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await addToTeam(projectId, selected, role);
      setRole('');
      setUserId('');
      onAdded();
    } catch (failure) {
      setError(describeError(failure));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={(event) => void submit(event)}
      className="mt-4 flex flex-col gap-3 border-t border-hairline pt-4 sm:flex-row sm:items-end"
    >
      <Field label="Persona" className="flex-1">
        <Select
          value={selected}
          onChange={(event) => setUserId(event.target.value)}
        >
          {candidates.map((candidate) => (
            <option key={candidate.userId} value={candidate.userId}>
              {candidate.name ?? candidate.email}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Rol en el proyecto" hint="Opcional">
        <Input
          maxLength={80}
          value={role}
          onChange={(event) => setRole(event.target.value)}
          placeholder="Calculista"
        />
      </Field>
      <Button type="submit" disabled={busy || !selected}>
        {busy ? 'Agregando…' : 'Agregar al equipo'}
      </Button>
      {error && (
        <Notice tone="error" className="sm:basis-full">
          {error}
        </Notice>
      )}
    </form>
  );
}
