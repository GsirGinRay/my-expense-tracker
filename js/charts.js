import { groupByCategory, monthlyTrend } from './stats.js';

const CATEGORY_COLORS = [
  '#60a5fa',
  '#f472b6',
  '#fbbf24',
  '#34d399',
  '#a78bfa',
  '#fb7185',
  '#22d3ee',
  '#f97316',
];

let categoryChart = null;
let trendChart = null;

function ensureChartJs() {
  if (typeof window.Chart === 'undefined') {
    console.warn('Chart.js 尚未載入，圖表無法顯示');
    return false;
  }
  return true;
}

export function renderCategoryChart(canvas, records, yearMonth) {
  if (!ensureChartJs()) return;

  const expenseData = groupByCategory(records, yearMonth, 'expense');
  const labels = Object.keys(expenseData);
  const values = Object.values(expenseData);

  if (categoryChart) {
    categoryChart.destroy();
    categoryChart = null;
  }

  if (labels.length === 0) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '14px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('本月尚無支出資料', canvas.width / 2, canvas.height / 2);
    return;
  }

  categoryChart = new window.Chart(canvas, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [
        {
          data: values,
          backgroundColor: labels.map(
            (_, i) => CATEGORY_COLORS[i % CATEGORY_COLORS.length],
          ),
          borderWidth: 2,
          borderColor: '#ffffff',
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom' },
        title: { display: true, text: `${yearMonth} 支出分類` },
      },
    },
  });
}

export function renderTrendChart(canvas, records) {
  if (!ensureChartJs()) return;

  const trend = monthlyTrend(records, 6);
  const labels = trend.map((t) => t.yearMonth);

  if (trendChart) {
    trendChart.destroy();
    trendChart = null;
  }

  trendChart = new window.Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: '收入',
          data: trend.map((t) => t.income),
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.15)',
          tension: 0.3,
          fill: true,
        },
        {
          label: '支出',
          data: trend.map((t) => t.expense),
          borderColor: '#ef4444',
          backgroundColor: 'rgba(239, 68, 68, 0.15)',
          tension: 0.3,
          fill: true,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom' },
        title: { display: true, text: '近 6 個月趨勢' },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: (value) => `$${value.toLocaleString('zh-TW')}`,
          },
        },
      },
    },
  });
}
