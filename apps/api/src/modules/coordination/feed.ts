import type { Change } from '@team27/context-capture';
import type { Impact } from '@team27/context-impact';
import type { Notification } from '@team27/context-notification';

export type ImpactView = Omit<Impact, 'changeId'>;

export interface FeedChange extends Change {
  readonly impact: ImpactView | null;
  readonly notifications: readonly Notification[];
}

export const composeFeed = (
  changes: readonly Change[],
  impacts: readonly Impact[],
  notifications: readonly Notification[],
  stakeholderOrder: readonly string[],
): FeedChange[] => {
  const impactByChange = new Map(
    impacts.map(({ changeId, ...impact }) => [changeId, impact]),
  );
  const rank = (stakeholderId: string) =>
    stakeholderOrder.indexOf(stakeholderId);
  return changes.map((change) => ({
    ...change,
    impact: impactByChange.get(change.id) ?? null,
    notifications: notifications
      .filter((notification) => notification.changeId === change.id)
      .sort((a, b) => rank(a.stakeholderId) - rank(b.stakeholderId)),
  }));
};
