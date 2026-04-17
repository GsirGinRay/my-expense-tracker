// 投資損益計算（純函式）。
// 台股慣例：1 張 = 1000 股；手續費 0.1425% × 折數，買賣各一次；交易稅 0.3% 賣出時收。
// 不處理「最低 20 元手續費」(個人記帳通常忽略)。

export const LOT_SIZE = 1000;
export const FEE_RATE = 0.001425;
export const TAX_RATE = 0.003;
export const DEFAULT_DISCOUNT = 0.6;

const round = (n) => Math.round(n);

/**
 * 計算一筆「賣出股票」的損益。
 * @param {object} input
 * @param {number} input.lots          張數（可小數，例 0.5 = 500 股）
 * @param {number} input.buyPrice      買進單價
 * @param {number} input.sellPrice     賣出單價
 * @param {number} [input.feeDiscount] 手續費折數，預設 0.6
 * @returns {{
 *   shares:number, buyAmount:number, sellAmount:number,
 *   buyFee:number, sellFee:number, tax:number, totalCost:number,
 *   pnl:number, type:'income'|'expense', amount:number
 * }}
 */
export function calculatePnL({ lots, buyPrice, sellPrice, feeDiscount = DEFAULT_DISCOUNT }) {
  const shares = Number(lots) * LOT_SIZE;
  const buyAmount = Number(buyPrice) * shares;
  const sellAmount = Number(sellPrice) * shares;

  const buyFee = round(buyAmount * FEE_RATE * Number(feeDiscount));
  const sellFee = round(sellAmount * FEE_RATE * Number(feeDiscount));
  const tax = round(sellAmount * TAX_RATE);
  const totalCost = buyFee + sellFee + tax;

  const pnl = sellAmount - buyAmount - totalCost;
  const type = pnl >= 0 ? 'income' : 'expense';
  const amount = Math.abs(pnl);

  return {
    shares,
    buyAmount,
    sellAmount,
    buyFee,
    sellFee,
    tax,
    totalCost,
    pnl,
    type,
    amount,
  };
}

// 從 DB 紀錄反推「張數」(用來填回編輯表單)。DB 存的是股數。
export function sharesToLots(shares) {
  if (shares == null) return null;
  return Number(shares) / LOT_SIZE;
}
