const ACTOR_KEY = 'agentcore-actor-id';

export function getActorId(): string {
  let id = localStorage.getItem(ACTOR_KEY);
  if (!id) {
    id = `devicetest-${crypto.randomUUID()}`;
    localStorage.setItem(ACTOR_KEY, id);
  }
  return id;
}
