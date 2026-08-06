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
