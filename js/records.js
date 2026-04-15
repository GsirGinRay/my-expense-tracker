function validateInput({ type, amount, category, date }) {
  if (!['income', 'expense'].includes(type)) {
    throw new Error('類型無效');
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('金額必須大於 0');
  }
  if (!category || typeof category !== 'string') {
    throw new Error('請選擇類別');
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error('日期格式錯誤');
  }
}

export function createRecord(input) {
  validateInput(input);
  return {
    id: crypto.randomUUID(),
    type: input.type,
    amount: Number(input.amount),
    category: input.category,
    merchant: input.merchant ?? '',
    date: input.date,
    note: input.note ?? '',
    createdAt: new Date().toISOString(),
  };
}

export function addRecord(records, input) {
  return [...records, createRecord(input)];
}

export function updateRecord(records, id, patch) {
  const existing = records.find((r) => r.id === id);
  if (!existing) throw new Error('找不到要更新的記帳');

  const merged = { ...existing, ...patch };
  validateInput(merged);

  return records.map((r) => (r.id === id ? merged : r));
}

export function deleteRecord(records, id) {
  return records.filter((r) => r.id !== id);
}

export function sortByDateDesc(records) {
  return [...records].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return a.createdAt < b.createdAt ? 1 : -1;
  });
}
