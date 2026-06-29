export class HostRateLimiter {
  private readonly lastAt = new Map<string, number>();

  constructor(private readonly minIntervalMs: number) {}

  async acquire(targetUrl: string): Promise<void> {
    const host = new URL(targetUrl).host;
    const now = Date.now();
    const last = this.lastAt.get(host) ?? 0;
    const wait = last + this.minIntervalMs - now;
    if (wait > 0) await new Promise(r => setTimeout(r, wait));
    this.lastAt.set(host, Date.now());
  }
}
