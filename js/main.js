import { api, ApiError } from './api.js';
import { isAuthed, login, register, logout, currentUser } from './auth.js';
import {
  appendRecord,
  replaceRecord,
  removeRecord,
} from './records.js';
import {
  summarize,
  availableMonths,
  currentYearMonth,
} from './stats.js';
import {
  renderSummary,
  renderCategoryOptions,
  renderMonthOptions,
  renderRecordList,
  showToast,
  resetForm,
  fillFormForEdit,
} from './ui.js';
import { renderCategoryChart, renderTrendChart } from './charts.js';
import { exportCsv, exportBackup, parseBackup } from './csv.js';

const state = {
  records: [],
  selectedMonth: currentYearMonth(),
};

const el = {
  authScreen: document.getElementById('auth-screen'),
  appRoot: document.getElementById('app-root'),
  authForm: document.getElementById('auth-form'),
  authSubmit: document.getElementById('auth-submit'),
  authError: document.getElementById('auth-error'),
  authTabs: document.querySelectorAll('.auth-tab'),
  userBar: document.getElementById('user-bar'),
  userEmail: document.getElementById('user-email'),
  logoutBtn: document.getElementById('logout-btn'),
  form: document.getElementById('record-form'),
  monthSelect: document.getElementById('month-filter'),
  listBody: document.getElementById('record-list-body'),
  categoryChart: document.getElementById('category-chart'),
  trendChart: document.getElementById('trend-chart'),
};

let authMode = 'login';

function render() {
  renderMonthOptions(
    el.monthSelect,
    availableMonths(state.records),
    state.selectedMonth,
  );
  renderSummary(summarize(state.records, state.selectedMonth));
  renderRecordList(el.listBody, state.records, state.selectedMonth);
  renderCategoryChart(el.categoryChart, state.records, state.selectedMonth);
  renderTrendChart(el.trendChart, state.records);
}

function showApp() {
  el.authScreen.hidden = true;
  el.appRoot.hidden = false;
  el.userBar.hidden = false;
  const user = currentUser();
  if (user?.email) el.userEmail.textContent = user.email;
}

function showAuth() {
  el.authScreen.hidden = false;
  el.appRoot.hidden = true;
  el.userBar.hidden = true;
  el.authError.hidden = true;
  el.authForm.reset();
  setAuthMode('login');
}

function setAuthMode(mode) {
  authMode = mode;
  el.authTabs.forEach((tab) => {
    tab.classList.toggle('active', tab.dataset.mode === mode);
  });
  el.authSubmit.textContent = mode === 'register' ? '建立帳號' : '登入';
  el.authError.hidden = true;
  const passwordField = el.authForm.querySelector('[name="password"]');
  passwordField.autocomplete = mode === 'register' ? 'new-password' : 'current-password';
}

function showAuthError(message) {
  el.authError.textContent = message;
  el.authError.hidden = false;
}

async function handleAuthSubmit(event) {
  event.preventDefault();
  const formData = new FormData(el.authForm);
  const email = String(formData.get('email') || '').trim();
  const password = String(formData.get('password') || '');

  el.authSubmit.disabled = true;
  el.authError.hidden = true;
  try {
    if (authMode === 'register') {
      await register(email, password);
      showToast('帳號已建立', 'success');
    } else {
      await login(email, password);
      showToast('登入成功', 'success');
    }
    await bootApp();
  } catch (err) {
    showAuthError(err.message || '操作失敗');
  } finally {
    el.authSubmit.disabled = false;
  }
}

function handleAuthTabClick(event) {
  const mode = event.currentTarget.dataset.mode;
  if (!mode || mode === authMode) return;
  setAuthMode(mode);
}

function handleLogout() {
  logout();
  state.records = [];
  state.selectedMonth = currentYearMonth();
  showAuth();
  showToast('已登出', 'info');
}

function handleTypeChange() {
  const type = el.form.querySelector('[name="type"]:checked').value;
  const categorySelect = el.form.querySelector('[name="category"]');
  renderCategoryOptions(categorySelect, type);
}

async function handleSubmit(event) {
  event.preventDefault();
  const formData = new FormData(el.form);
  const input = {
    type: formData.get('type'),
    amount: Number(formData.get('amount')),
    category: formData.get('category'),
    merchant: (formData.get('merchant') ?? '').toString().trim(),
    date: formData.get('date'),
    note: (formData.get('note') ?? '').toString().trim(),
  };
  const editingId = formData.get('recordId');
  const submitBtn = document.getElementById('submit-btn');

  submitBtn.disabled = true;
  try {
    if (editingId) {
      const updated = await api.updateRecord(editingId, input);
      state.records = replaceRecord(state.records, editingId, updated);
      showToast('記帳已更新', 'success');
    } else {
      const created = await api.createRecord(input);
      state.records = appendRecord(state.records, created);
      showToast('已新增一筆記帳', 'success');
    }
    render();
    resetForm(el.form);
    handleTypeChange();
  } catch (err) {
    handleApiError(err, '儲存失敗');
  } finally {
    submitBtn.disabled = false;
  }
}

async function handleListClick(event) {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  const tr = button.closest('tr[data-id]');
  if (!tr) return;
  const id = tr.dataset.id;
  const record = state.records.find((r) => r.id === id);
  if (!record) return;

  if (button.dataset.action === 'edit') {
    fillFormForEdit(el.form, record);
    return;
  }

  if (button.dataset.action === 'delete') {
    if (!confirm(`確定要刪除 ${record.date} 的「${record.category}」嗎？`)) return;
    button.disabled = true;
    try {
      await api.deleteRecord(id);
      state.records = removeRecord(state.records, id);
      render();
      if (el.form.querySelector('[name="recordId"]').value === id) {
        resetForm(el.form);
        handleTypeChange();
      }
      showToast('已刪除', 'success');
    } catch (err) {
      handleApiError(err, '刪除失敗');
    } finally {
      button.disabled = false;
    }
  }
}

function handleMonthChange(event) {
  state.selectedMonth = event.target.value;
  render();
}

function handleExportCsv() {
  if (state.records.length === 0) {
    showToast('沒有資料可匯出', 'info');
    return;
  }
  exportCsv(state.records);
  showToast('CSV 已下載', 'success');
}

function handleBackup() {
  if (state.records.length === 0) {
    showToast('沒有資料可備份', 'info');
    return;
  }
  exportBackup(state.records);
  showToast('備份已下載', 'success');
}

function handleRestoreChange(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const records = parseBackup(reader.result);
      if (
        state.records.length > 0 &&
        !confirm('還原將覆蓋資料庫中目前所有資料，確定要繼續？')
      ) {
        event.target.value = '';
        return;
      }
      const restored = await api.restoreRecords(records);
      state.records = restored;
      render();
      showToast(`已還原 ${restored.length} 筆資料`, 'success');
    } catch (err) {
      handleApiError(err, '還原失敗');
    } finally {
      event.target.value = '';
    }
  };
  reader.onerror = () => {
    showToast('讀取檔案失敗', 'error');
    event.target.value = '';
  };
  reader.readAsText(file);
}

function handleCancelEdit() {
  resetForm(el.form);
  handleTypeChange();
}

function handleApiError(err, fallbackMsg) {
  console.error(err);
  if (err instanceof ApiError && err.status === 401) {
    logout();
    showAuth();
    showToast('登入已過期，請重新登入', 'error');
    return;
  }
  showToast(err?.message || fallbackMsg, 'error');
}

async function bootApp() {
  showApp();
  resetForm(el.form);
  handleTypeChange();
  state.records = [];
  state.selectedMonth = currentYearMonth();
  render();

  try {
    const records = await api.listRecords();
    state.records = records;
    state.selectedMonth = currentYearMonth();
    render();
  } catch (err) {
    handleApiError(err, '載入記帳資料失敗');
  }
}

function bindEvents() {
  el.authForm.addEventListener('submit', handleAuthSubmit);
  el.authTabs.forEach((tab) => tab.addEventListener('click', handleAuthTabClick));
  el.logoutBtn.addEventListener('click', handleLogout);

  el.form.addEventListener('submit', handleSubmit);
  el.form
    .querySelectorAll('[name="type"]')
    .forEach((radio) => radio.addEventListener('change', handleTypeChange));
  el.listBody.addEventListener('click', handleListClick);
  el.monthSelect.addEventListener('change', handleMonthChange);

  document.getElementById('export-csv-btn').addEventListener('click', handleExportCsv);
  document.getElementById('backup-btn').addEventListener('click', handleBackup);
  document.getElementById('restore-input').addEventListener('change', handleRestoreChange);
  document.getElementById('cancel-edit-btn').addEventListener('click', handleCancelEdit);
}

async function init() {
  bindEvents();
  if (isAuthed()) {
    await bootApp();
  } else {
    showAuth();
  }
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  if (location.protocol !== 'http:' && location.protocol !== 'https:') return;
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('./service-worker.js')
      .catch((err) => console.warn('SW 註冊失敗：', err));
  });

  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) return;
    reloading = true;
    window.location.reload();
  });
}

function setupInstallPrompt() {
  const btn = document.getElementById('install-btn');
  const hint = document.getElementById('install-hint');
  if (!btn) return;

  const hideAll = () => {
    btn.hidden = true;
    if (hint) hint.hidden = true;
  };

  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;
  if (isStandalone) return hideAll();

  let prompt = window.__deferredInstallPrompt || null;

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    prompt = event;
    window.__deferredInstallPrompt = event;
  });

  btn.addEventListener('click', async () => {
    if (!prompt) return;
    prompt.prompt();
    const { outcome } = await prompt.userChoice;
    prompt = null;
    window.__deferredInstallPrompt = null;
    if (outcome === 'accepted') hideAll();
  });

  window.addEventListener('appinstalled', () => {
    hideAll();
    showToast('已安裝到主畫面 🎉', 'success');
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

registerServiceWorker();
setupInstallPrompt();
