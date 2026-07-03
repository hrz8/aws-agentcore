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

  for (const sig of ['SIGINT', 'SIGTERM'] as const) {
    process.on(sig, () => {
      setTimeout(() => {
        console.warn(`[${name}] forced exit after 5s`);
        process.exit(1);
      }, 5000).unref();
    });
  }
}
