export const EXPENSE_CATEGORIES = [
  '餐飲',
  '交通',
  '購物',
  '娛樂',
  '居家',
  '醫療',
  '教育',
  '其他',
];

export const INCOME_CATEGORIES = [
  '薪資',
  '獎金',
  '退款',
  '其他',
];

// 投資紀錄專用 — 不放進 income/expense 下拉，避免使用者誤選成沒有 stock_name 的孤兒。
// 寫入 DB 時 category 固定為這個值。
export const INVESTMENT_CATEGORY = '投資';

export function getCategories(type) {
  return type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
}
