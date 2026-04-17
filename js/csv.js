function escapeCsv(value) {
  const str = String(value ?? '');
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function typeLabel(r) {
  if (r.category === '投資' && r.stockName) return '投資';
  return r.type === 'income' ? '收入' : '支出';
}

const LOT_SIZE = 1000;

export function recordsToCsv(records) {
  const header = [
    '日期', '類型', '類別', '商家', '金額', '備註',
    '股票名稱', '張數', '買進價', '賣出價', '折數',
  ];
  const rows = records.map((r) => {
    const isInvestment = r.category === '投資' && r.stockName;
    return [
      r.date,
      typeLabel(r),
      r.category,
      r.merchant ?? '',
      r.amount,
      r.note ?? '',
      isInvestment ? r.stockName : '',
      isInvestment && r.shares != null ? r.shares / LOT_SIZE : '',
      isInvestment && r.buyPrice != null ? r.buyPrice : '',
      isInvestment && r.sellPrice != null ? r.sellPrice : '',
      isInvestment && r.feeDiscount != null ? r.feeDiscount : '',
    ];
  });
  const all = [header, ...rows];
  const BOM = '\uFEFF';
  return BOM + all.map((row) => row.map(escapeCsv).join(',')).join('\r\n');
}

function triggerDownload(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function todayStamp() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

export function exportCsv(records) {
  const csv = recordsToCsv(records);
  triggerDownload(`記帳_${todayStamp()}.csv`, csv, 'text/csv;charset=utf-8');
}

export function exportBackup(records) {
  const json = JSON.stringify({ version: 1, records }, null, 2);
  triggerDownload(
    `記帳備份_${todayStamp()}.json`,
    json,
    'application/json;charset=utf-8',
  );
}

export function parseBackup(text) {
  const parsed = JSON.parse(text);
  const records = Array.isArray(parsed) ? parsed : parsed?.records;
  if (!Array.isArray(records)) {
    throw new Error('備份檔格式錯誤');
  }
  return records;
}
