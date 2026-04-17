import { getCategories } from './categories.js';
import { sortByDateDesc } from './records.js';
import { filterByMonth } from './stats.js';
import { sharesToLots, DEFAULT_DISCOUNT } from './investment.js';

export function formatMoney(value) {
  const sign = value < 0 ? '-' : '';
  return `${sign}$${Math.abs(Math.round(value)).toLocaleString('zh-TW')}`;
}

export function renderSummary({
  income, expense, balance,
  investmentProfit, investmentLoss, investmentNet,
}) {
  document.getElementById('summary-income').textContent = formatMoney(income);
  document.getElementById('summary-expense').textContent = formatMoney(expense);
  const balanceEl = document.getElementById('summary-balance');
  balanceEl.textContent = formatMoney(balance);
  balanceEl.classList.toggle('negative', balance < 0);
  balanceEl.classList.toggle('positive', balance >= 0);

  const profitEl = document.getElementById('summary-inv-profit');
  const lossEl = document.getElementById('summary-inv-loss');
  const netEl = document.getElementById('summary-inv-net');
  if (profitEl) profitEl.textContent = formatMoney(investmentProfit ?? 0);
  if (lossEl) lossEl.textContent = formatMoney(investmentLoss ?? 0);
  if (netEl) {
    const net = investmentNet ?? 0;
    netEl.textContent = formatMoney(net);
    netEl.classList.toggle('negative', net < 0);
    netEl.classList.toggle('positive', net >= 0);
  }
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

const escapeHtml = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function isInvestmentRecord(r) {
  return r.category === '投資' && r.stockName;
}

function formatLots(shares) {
  const lots = sharesToLots(shares);
  if (lots == null) return '';
  // 整張不顯示小數，零碎張顯示 3 位
  return Number.isInteger(lots) ? `${lots}` : lots.toFixed(3).replace(/\.?0+$/, '');
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

  tbody.innerHTML = monthly
    .map((r) => {
      const typeClass = r.type === 'income' ? 'type-income' : 'type-expense';
      const amountSign = r.type === 'income' ? '+' : '-';
      let typeText = r.type === 'income' ? '收入' : '支出';
      let categoryText = escapeHtml(r.category);
      let merchantText = r.merchant ? escapeHtml(r.merchant) : '';
      let noteText = r.note ? escapeHtml(r.note) : '';

      if (isInvestmentRecord(r)) {
        typeText = '投資';
        const lots = formatLots(r.shares);
        const buy = r.buyPrice != null ? r.buyPrice : '?';
        const sell = r.sellPrice != null ? r.sellPrice : '?';
        merchantText = `${escapeHtml(r.stockName)} <small>${lots} 張</small>`;
        const detail = `買 $${buy} → 賣 $${sell}`;
        noteText = noteText
          ? `${escapeHtml(detail)}<br><small>${noteText}</small>`
          : escapeHtml(detail);
      }

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

function applyFormMode(form, mode) {
  const normal = document.getElementById('normal-fields');
  const investment = document.getElementById('investment-fields');
  const isInvestment = mode === 'investment';
  if (normal) normal.hidden = isInvestment;
  if (investment) investment.hidden = !isInvestment;

  // 切到投資模式時把一般欄位的 required 拿掉，避免提交時被卡住。
  const amount = form.querySelector('[name="amount"]');
  const category = form.querySelector('[name="category"]');
  if (amount) amount.required = !isInvestment;
  if (category) category.required = !isInvestment;
}

export function resetForm(form) {
  form.reset();
  form.querySelector('[name="type"][value="expense"]').checked = true;
  form.querySelector('[name="date"]').valueAsDate = new Date();
  form.querySelector('[name="recordId"]').value = '';

  // 投資欄位 reset 後 fee discount 預設 0.6，並回到一般模式。
  const feeDiscount = form.querySelector('[name="feeDiscount"]');
  if (feeDiscount) feeDiscount.value = String(DEFAULT_DISCOUNT);
  const preview = document.getElementById('pnl-preview');
  if (preview) preview.textContent = '填入欄位後即時計算損益…';

  applyFormMode(form, 'expense');

  document.getElementById('form-title').textContent = '新增記帳';
  document.getElementById('submit-btn').textContent = '新增';
  document.getElementById('cancel-edit-btn').hidden = true;
}

export function fillFormForEdit(form, record) {
  form.querySelector('[name="recordId"]').value = record.id;

  if (isInvestmentRecord(record)) {
    form.querySelector('[name="type"][value="investment"]').checked = true;
    applyFormMode(form, 'investment');
    form.querySelector('[name="stockName"]').value = record.stockName ?? '';
    const lots = sharesToLots(record.shares);
    form.querySelector('[name="lots"]').value = lots != null ? lots : '';
    form.querySelector('[name="buyPrice"]').value = record.buyPrice ?? '';
    form.querySelector('[name="sellPrice"]').value = record.sellPrice ?? '';
    form.querySelector('[name="feeDiscount"]').value =
      record.feeDiscount != null ? record.feeDiscount : DEFAULT_DISCOUNT;
    // 觸發一次計算讓預覽顯示
    form.querySelector('[name="lots"]').dispatchEvent(new Event('input', { bubbles: true }));
  } else {
    form.querySelector(`[name="type"][value="${record.type}"]`).checked = true;
    applyFormMode(form, record.type);
    renderCategoryOptions(
      form.querySelector('[name="category"]'),
      record.type,
      record.category,
    );
    form.querySelector('[name="amount"]').value = record.amount;
    form.querySelector('[name="merchant"]').value = record.merchant ?? '';
  }

  form.querySelector('[name="date"]').value = record.date;
  form.querySelector('[name="note"]').value = record.note ?? '';

  document.getElementById('form-title').textContent = '編輯記帳';
  document.getElementById('submit-btn').textContent = '更新';
  document.getElementById('cancel-edit-btn').hidden = false;
  form.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// 給 main.js 用：依當前選擇 type 切換 normal/investment 顯示。
export function syncFormMode(form) {
  const checked = form.querySelector('[name="type"]:checked');
  applyFormMode(form, checked ? checked.value : 'expense');
}
