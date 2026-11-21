import { createInterface, type Interface } from 'node:readline';

export class Prompt {
  private readonly rl: Interface;
  private readonly queue: string[] = [];
  private waiter: ((line: string | null) => void) | null = null;
  private closed = false;

  constructor(input: NodeJS.ReadableStream, output: NodeJS.WritableStream) {
    this.rl = createInterface({ input, output, terminal: false });
    this.rl.on('line', (line) => {
      if (this.waiter) {
        const resolve = this.waiter;
        this.waiter = null;
        resolve(line.trim().toLowerCase());
      } else {
        this.queue.push(line.trim().toLowerCase());
      }
    });
    this.rl.on('close', () => {
      this.closed = true;
      if (this.waiter) {
        const resolve = this.waiter;
        this.waiter = null;
        resolve(null);
      }
    });
  }

  ask(text: string): Promise<string | null> {
    process.stdout.write(text);
    const queued = this.queue.shift();
    if (queued !== undefined) return Promise.resolve(queued);
    if (this.closed) return Promise.resolve(null);
    return new Promise((resolve) => {
      this.waiter = resolve;
    });
  }

  take(): string | null {
    return this.queue.shift() ?? null;
  }

  isClosed(): boolean {
    return this.closed;
  }

  close(): void {
    this.rl.close();
  }
}
