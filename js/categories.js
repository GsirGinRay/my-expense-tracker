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
  '投資',
  '退款',
  '其他',
];

export function getCategories(type) {
  return type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
}
