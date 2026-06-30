const THREAD_KEY = 'agui-thread-id';

export function loadOrMintThreadId(): string {
  let id = localStorage.getItem(THREAD_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(THREAD_KEY, id);
  }
  return id;
}

export function mintThreadId(): string {
  const id = crypto.randomUUID();
  localStorage.setItem(THREAD_KEY, id);
  return id;
}
