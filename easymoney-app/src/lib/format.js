import dayjs from 'dayjs';

const currencyFormatter = new Intl.NumberFormat('ja-JP', {
	style: 'currency',
	currency: 'JPY',
	maximumFractionDigits: 0,
});

export const formatCurrency = (value = 0) => currencyFormatter.format(Math.round(value));
export const formatDate = (value) => (value ? dayjs(value).format('YYYY/MM/DD') : '');
export const today = () => dayjs().format('YYYY-MM-DD');
export const monthKey = (value) => dayjs(value).format('YYYY-MM');
