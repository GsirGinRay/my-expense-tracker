export function getYearMonth(date) {
  return date.slice(0, 7);
}

export function currentYearMonth() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export function filterByMonth(records, yearMonth) {
  if (!yearMonth) return records;
  return records.filter((r) => getYearMonth(r.date) === yearMonth);
}

export function summarize(records, yearMonth) {
  const monthly = filterByMonth(records, yearMonth);
  const income = monthly
    .filter((r) => r.type === 'income')
    .reduce((sum, r) => sum + r.amount, 0);
  const expense = monthly
    .filter((r) => r.type === 'expense')
    .reduce((sum, r) => sum + r.amount, 0);
  return {
    income,
    expense,
    balance: income - expense,
  };
}

export function groupByCategory(records, yearMonth, type) {
  const filtered = filterByMonth(records, yearMonth).filter(
    (r) => r.type === type,
  );
  return filtered.reduce((acc, r) => {
    acc[r.category] = (acc[r.category] ?? 0) + r.amount;
    return acc;
  }, {});
}

export function monthlyTrend(records, monthsBack = 6) {
  const months = [];
  const now = new Date();
  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const { income, expense } = summarize(records, ym);
    months.push({ yearMonth: ym, income, expense });
  }
  return months;
}

export function availableMonths(records) {
  const set = new Set(records.map((r) => getYearMonth(r.date)));
  set.add(currentYearMonth());
  return [...set].sort().reverse();
}
