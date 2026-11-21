const numberFormat = new Intl.NumberFormat('es-CL', {
  maximumFractionDigits: 2,
});
const moneyFormat = new Intl.NumberFormat('es-CL', {
  style: 'currency',
  currency: 'CLP',
  maximumFractionDigits: 0,
});

export const formatNumber = (value: number): string =>
  numberFormat.format(value);

export const formatMoney = (value: number): string => moneyFormat.format(value);

export const formatSignedMoney = (value: number): string =>
  `${value > 0 ? '+' : value < 0 ? '−' : ''}${formatMoney(Math.abs(value))}`;

export const formatSignedNumber = (value: number): string =>
  `${value > 0 ? '+' : value < 0 ? '−' : ''}${formatNumber(Math.abs(value))}`;

export const formatDays = (days: number): string =>
  `${formatNumber(days)} ${Math.abs(days) === 1 ? 'día' : 'días'}`;
