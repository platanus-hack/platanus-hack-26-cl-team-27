export interface AcknowledgementDraft {
  readonly documentId: string;
  readonly revisionId: string;
  readonly signature: string;
  readonly ownerId: string;
  readonly note: string;
}

export interface Acknowledgement extends AcknowledgementDraft {
  readonly id: string;
  readonly at: Date;
}
