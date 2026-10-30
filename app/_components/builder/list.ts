// Operações imutáveis nas listas do builder.

// Id estável de cada item para `key` e para o arraste. Fica fora do QueryState (não vai para o histórico
// nem para as consultas salvas); `replaceAt` o repassa ao objeto novo, já que as edições são imutáveis.
const ids = new WeakMap<object, string>();

export function idOf(item: object): string {
  let id = ids.get(item);
  if (!id) {
    id = crypto.randomUUID();
    ids.set(item, id);
  }
  return id;
}

export function replaceAt<T>(items: T[], index: number, item: T): T[] {
  const current = items[index];
  if (typeof current === "object" && typeof item === "object" && current && item && current !== item) {
    ids.set(item, idOf(current));
  }
  return items.map((value, i) => (i === index ? item : value));
}

export function removeAt<T>(items: T[], index: number): T[] {
  return items.filter((_, i) => i !== index);
}

export function move<T>(items: T[], from: number, to: number): T[] {
  if (to < 0 || to >= items.length) return items;
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}
