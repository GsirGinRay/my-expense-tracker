const STORAGE_KEY = 'accounting.records.v1';

export function loadRecords() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error('讀取記帳資料失敗:', error);
    return [];
  }
}

export function saveRecords(records) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch (error) {
    console.error('儲存記帳資料失敗:', error);
    throw new Error('無法儲存資料，可能是瀏覽器空間不足');
  }
}

export function clearRecords() {
  localStorage.removeItem(STORAGE_KEY);
}
