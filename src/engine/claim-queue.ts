export class ClaimQueue {
  private queue: Array<() => Promise<void>> = [];
  private processing = false;

  async enqueue<T>(operation: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push(async () => {
        try {
          resolve(await operation());
        } catch (e) {
          reject(e);
        }
      });
      this.process();
    });
  }

  private async process(): Promise<void> {
    if (this.processing || this.queue.length === 0) return;
    this.processing = true;
    while (this.queue.length > 0) {
      const op = this.queue.shift()!;
      await op();
    }
    this.processing = false;
  }
}
