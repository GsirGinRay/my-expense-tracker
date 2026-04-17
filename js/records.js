export function appendRecord(records, record) {
  return [...records, record];
}

export function replaceRecord(records, id, updated) {
  return records.map((r) => (r.id === id ? updated : r));
}

export function removeRecord(records, id) {
  return records.filter((r) => r.id !== id);
}

export function sortByDateDesc(records) {
  return [...records].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return a.createdAt < b.createdAt ? 1 : -1;
  });
}
