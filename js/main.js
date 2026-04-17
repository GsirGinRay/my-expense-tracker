import { loadRecords, saveRecords } from './storage.js';
import {
  addRecord,
  updateRecord,
  deleteRecord,
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

const form = document.getElementById('record-form');
const monthSelect = document.getElementById('month-filter');
const listBody = document.getElementById('record-list-body');
const categoryChartCanvas = document.getElementById('category-chart');
const trendChartCanvas = document.getElementById('trend-chart');

function render() {
  renderMonthOptions(
    monthSelect,
    availableMonths(state.records),
    state.selectedMonth,
  );
  renderSummary(summarize(state.records, state.selectedMonth));
  renderRecordList(listBody, state.records, state.selectedMonth);
  renderCategoryChart(categoryChartCanvas, state.records, state.selectedMonth);
  renderTrendChart(trendChartCanvas, state.records);
}

function persist(nextRecords) {
  saveRecords(nextRecords);
  state.records = nextRecords;
  render();
}

function handleTypeChange() {
  const type = form.querySelector('[name="type"]:checked').value;
  const categorySelect = form.querySelector('[name="category"]');
  renderCategoryOptions(categorySelect, type);
}

function handleSubmit(event) {
  event.preventDefault();
  const formData = new FormData(form);
  const input = {
    type: formData.get('type'),
    amount: Number(formData.get('amount')),
    category: formData.get('category'),
    merchant: (formData.get('merchant') ?? '').toString().trim(),
    date: formData.get('date'),
    note: (formData.get('note') ?? '').toString().trim(),
  };

  const editingId = formData.get('recordId');

  try {
    if (editingId) {
      persist(updateRecord(state.records, editingId, input));
      showToast('記帳已更新', 'success');
    } else {
      persist(addRecord(state.records, input));
      showToast('已新增一筆記帳', 'success');
    }
    resetForm(form);
    handleTypeChange();
  } catch (error) {
    console.error(error);
    showToast(error.message, 'error');
  }
}

function handleListClick(event) {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  const tr = button.closest('tr[data-id]');
  if (!tr) return;
  const id = tr.dataset.id;
  const record = state.records.find((r) => r.id === id);
  if (!record) return;

  if (button.dataset.action === 'edit') {
    fillFormForEdit(form, record);
  } else if (button.dataset.action === 'delete') {
    if (!confirm(`確定要刪除 ${record.date} 的「${record.category}」嗎？`)) return;
    try {
      persist(deleteRecord(state.records, id));
      showToast('已刪除', 'success');
      if (form.querySelector('[name="recordId"]').value === id) {
        resetForm(form);
        handleTypeChange();
      }
    } catch (error) {
      console.error(error);
      showToast(error.message, 'error');
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
  reader.onload = () => {
    try {
      const records = parseBackup(reader.result);
      if (
        state.records.length > 0 &&
        !confirm('還原將覆蓋目前所有資料，確定要繼續？')
      ) {
        event.target.value = '';
        return;
      }
      persist(records);
      showToast(`已還原 ${records.length} 筆資料`, 'success');
    } catch (error) {
      console.error(error);
      showToast(`還原失敗：${error.message}`, 'error');
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
  resetForm(form);
  handleTypeChange();
}

function init() {
  state.records = loadRecords();
  resetForm(form);
  handleTypeChange();
  render();

  form.addEventListener('submit', handleSubmit);
  form
    .querySelectorAll('[name="type"]')
    .forEach((radio) => radio.addEventListener('change', handleTypeChange));
  listBody.addEventListener('click', handleListClick);
  monthSelect.addEventListener('change', handleMonthChange);

  document.getElementById('export-csv-btn').addEventListener('click', handleExportCsv);
  document.getElementById('backup-btn').addEventListener('click', handleBackup);
  document.getElementById('restore-input').addEventListener('change', handleRestoreChange);
  document.getElementById('cancel-edit-btn').addEventListener('click', handleCancelEdit);
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  if (location.protocol !== 'http:' && location.protocol !== 'https:') return;
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('./service-worker.js')
      .catch((err) => console.warn('SW 註冊失敗：', err));
  });

  // When a new SW takes over, reload once so the page runs the fresh assets
  // it precached. Guard against loops.
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) return;
    reloading = true;
    window.location.reload();
  });
}

function setupInstallPrompt() {
  const installBtn = document.getElementById('install-btn');
  if (!installBtn) return;

  // Already running as installed PWA → hide the button.
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;
  if (isStandalone) {
    installBtn.hidden = true;
    return;
  }
  // Otherwise the button stays visible (default in HTML). Chrome only fires
  // `beforeinstallprompt` once and won't re-fire after dismissal — hiding the
  // button in that case strands the user with no install affordance.

  let deferredPrompt = null;
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event;
  });

  installBtn.addEventListener('click', async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      // The deferred prompt can only be used once.
      deferredPrompt = null;
      if (outcome === 'accepted') {
        // `appinstalled` will fire next and hide the button.
        return;
      }
      showToast('已取消。下次可從 Chrome 選單 ⋮ →「安裝應用程式」', 'info');
      return;
    }
    if (isIos) {
      showToast('請點瀏覽器分享鈕 → 加入主畫面', 'info');
    } else {
      showToast('請從 Chrome 選單 ⋮ →「安裝應用程式」', 'info');
    }
  });

  window.addEventListener('appinstalled', () => {
    installBtn.hidden = true;
    deferredPrompt = null;
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
