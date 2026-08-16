export function createCurrencyFormatter(currency = 'VND') {
  const currencyCode = currency || 'VND';
  
  let locale = 'vi-VN';
  if (currencyCode === 'USD') locale = 'en-US';
  else if (currencyCode === 'EUR') locale = 'de-DE';
  else if (currencyCode === 'JPY') locale = 'ja-JP';
  else if (currencyCode === 'GBP') locale = 'en-GB';

  return (value) =>
    new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currencyCode,
      maximumFractionDigits: (currencyCode === 'VND' || currencyCode === 'JPY') ? 0 : 2,
    }).format(value || 0);
}

export function formatCurrency(value, currency = 'VND') {
  return createCurrencyFormatter(currency)(value);
}

// Rút gọn số tiền cho chip nhỏ: 20000 -> "20k", 1500000 -> "1,5M"
export function formatShortAmount(value) {
  const amount = Number(value) || 0;

  if (amount >= 1000000) {
    const millions = amount / 1000000;
    return `${Number.isInteger(millions) ? millions : millions.toFixed(1).replace('.', ',')}M`;
  }

  if (amount >= 1000) {
    const thousands = amount / 1000;
    return `${Number.isInteger(thousands) ? thousands : thousands.toFixed(1).replace('.', ',')}k`;
  }

  return String(amount);
}
