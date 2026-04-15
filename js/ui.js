import { getCategories } from './categories.js';
import { sortByDateDesc } from './records.js';
import { filterByMonth } from './stats.js';

export function formatMoney(value) {
  const sign = value < 0 ? '-' : '';
  return `${sign}$${Math.abs(Math.round(value)).toLocaleString('zh-TW')}`;
}

export function renderSummary({ income, expense, balance }) {
  document.getElementById('summary-income').textContent = formatMoney(income);
  document.getElementById('summary-expense').textContent = formatMoney(expense);
  const balanceEl = document.getElementById('summary-balance');
  balanceEl.textContent = formatMoney(balance);
  balanceEl.classList.toggle('negative', balance < 0);
  balanceEl.classList.toggle('positive', balance >= 0);
}

export function renderCategoryOptions(selectEl, type, selected) {
  const options = getCategories(type);
  selectEl.innerHTML = options
    .map(
      (c) =>
        `<option value="${c}"${c === selected ? ' selected' : ''}>${c}</option>`,
    )
    .join('');
}

export function renderMonthOptions(selectEl, months, selected) {
  selectEl.innerHTML = months
    .map(
      (m) =>
        `<option value="${m}"${m === selected ? ' selected' : ''}>${m}</option>`,
    )
    .join('');
}

export function renderRecordList(tbody, records, yearMonth) {
  const monthly = sortByDateDesc(filterByMonth(records, yearMonth));

  if (monthly.length === 0) {
    tbody.innerHTML = `
      <tr class="empty-row">
        <td colspan="7">這個月還沒有記帳，開始新增第一筆吧！</td>
      </tr>`;
    return;
  }

  const escapeHtml = (s) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  tbody.innerHTML = monthly
    .map((r) => {
      const typeClass = r.type === 'income' ? 'type-income' : 'type-expense';
      const typeText = r.type === 'income' ? '收入' : '支出';
      const amountSign = r.type === 'income' ? '+' : '-';
      const noteText = r.note ? escapeHtml(r.note) : '';
      const categoryText = escapeHtml(r.category);
      const merchantText = r.merchant ? escapeHtml(r.merchant) : '';
      return `
        <tr data-id="${r.id}">
          <td>${r.date}</td>
          <td><span class="tag ${typeClass}">${typeText}</span></td>
          <td>${categoryText}</td>
          <td class="merchant">${merchantText}</td>
          <td class="amount ${typeClass}">${amountSign}${formatMoney(r.amount).replace('-', '')}</td>
          <td class="note">${noteText}</td>
          <td class="actions">
            <button type="button" class="btn-edit" data-action="edit">編輯</button>
            <button type="button" class="btn-delete" data-action="delete">刪除</button>
          </td>
        </tr>`;
    })
    .join('');
}

export function showToast(message, variant = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast toast-${variant}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('toast-fade');
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}

export function resetForm(form) {
  form.reset();
  form.querySelector('[name="type"][value="expense"]').checked = true;
  form.querySelector('[name="date"]').valueAsDate = new Date();
  form.querySelector('[name="recordId"]').value = '';
  document.getElementById('form-title').textContent = '新增記帳';
  document.getElementById('submit-btn').textContent = '新增';
  document.getElementById('cancel-edit-btn').hidden = true;
}

export function fillFormForEdit(form, record) {
  form.querySelector(`[name="type"][value="${record.type}"]`).checked = true;
  renderCategoryOptions(
    form.querySelector('[name="category"]'),
    record.type,
    record.category,
  );
  form.querySelector('[name="amount"]').value = record.amount;
  form.querySelector('[name="merchant"]').value = record.merchant ?? '';
  form.querySelector('[name="date"]').value = record.date;
  form.querySelector('[name="note"]').value = record.note ?? '';
  form.querySelector('[name="recordId"]').value = record.id;

  document.getElementById('form-title').textContent = '編輯記帳';
  document.getElementById('submit-btn').textContent = '更新';
  document.getElementById('cancel-edit-btn').hidden = false;
  form.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
