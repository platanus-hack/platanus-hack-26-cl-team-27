export interface ReasonRecipient {
  readonly stakeholderId: string;
  readonly name: string;
  readonly role: string;
  readonly findings: readonly string[];
}

export interface NoticeReason {
  readonly stakeholderId: string;
  readonly why: string;
}

export const MAX_REASON_LENGTH = 240;

const NUMBER = /\d+(?:[.,]\d+)*/g;

const numbersIn = (text: string): string[] => text.match(NUMBER) ?? [];

export const screenReasons = (
  reasons: readonly NoticeReason[],
  recipients: readonly ReasonRecipient[],
  source: string,
): NoticeReason[] => {
  const known = new Set(
    numbersIn(
      [
        source,
        ...recipients.flatMap((recipient) => [
          recipient.name,
          recipient.role,
          ...recipient.findings,
        ]),
      ].join('\n'),
    ),
  );
  const pending = new Set(
    recipients.map((recipient) => recipient.stakeholderId),
  );
  const accepted: NoticeReason[] = [];
  for (const reason of reasons) {
    const why = reason.why.replace(/\s+/g, ' ').trim();
    if (!pending.has(reason.stakeholderId)) continue;
    if (why === '' || why.length > MAX_REASON_LENGTH) continue;
    if (numbersIn(why).some((number) => !known.has(number))) continue;
    pending.delete(reason.stakeholderId);
    accepted.push({ stakeholderId: reason.stakeholderId, why });
  }
  return accepted;
};
