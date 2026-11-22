import { Injectable } from '@nestjs/common';

export type ChangeListener = () => void;

@Injectable()
export class ChangeSignal {
  private readonly listeners = new Set<ChangeListener>();

  subscribe(listener: ChangeListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  notify(): void {
    for (const listener of [...this.listeners]) listener();
  }
}
