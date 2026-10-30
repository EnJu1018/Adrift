export function diaryQuery(records) {
  let limit = Infinity;
  return { select() { return this; }, sort() { return this; }, limit(value) { limit = value; return this; },
    maxTimeMS() { return this; }, lean: async () => records.slice(0, limit) };
}
