/**
 * Wires SIGINT/SIGTERM to a user-provided close fn, then exits.
 *
 * Without this, an active listen socket keeps the event loop alive after the
 * main function returns — tsx watch ends up force-killing after 5s. The
 * backstop timer guards against `close()` itself hanging (e.g. a long-lived
 * SSE stream that never finishes).
 */
export function shutdown(
  name: string,
  close: () => Promise<void> | void,
): void {
  let shuttingDown = false;
  async function handle(signal: NodeJS.Signals): Promise<void> {
    if (shuttingDown) return;
    shuttingDown = true;
    console.info(`[${name}] ${signal} received, closing`);
    try {
      await close();
    } catch (err) {
      console.error(`[${name}] error during close:`, err);
    }
    process.exit(0);
  }

  process.on('SIGINT', handle);
  process.on('SIGTERM', handle);

  // Backstop: if close() hangs, hard-exit after 5s.
  for (const sig of ['SIGINT', 'SIGTERM'] as const) {
    process.on(sig, () => {
      setTimeout(() => {
        console.warn(`[${name}] forced exit after 5s`);
        process.exit(1);
      }, 5000).unref();
    });
  }
}
