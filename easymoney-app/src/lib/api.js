const withJson = (options = {}) => {
	const headers = new Headers(options.headers || {});
	if (!(options.body instanceof FormData)) {
		headers.set('content-type', 'application/json');
	}
	return { ...options, headers };
};

const handleResponse = async (response) => {
	if (response.headers.get('content-type')?.includes('application/json')) {
		const data = await response.json();
		if (!response.ok) {
			throw new Error(data.error || 'API Error');
		}
		return data;
	}

	if (!response.ok) {
		throw new Error('API Error');
	}
	return response;
};

const request = async (path, options = {}) => {
	const fetchOptions =
		options.body instanceof FormData ? { ...options } : withJson(options);

	if (fetchOptions.body && !(fetchOptions.body instanceof FormData)) {
		fetchOptions.body = JSON.stringify(fetchOptions.body);
	}

	const response = await fetch(`/api${path}`, fetchOptions);
	return handleResponse(response);
};

export const api = {
	listAccounts: () => request('/accounts'),
	createAccount: (payload) => request('/accounts', { method: 'POST', body: payload }),
	updateAccount: (id, payload) => request(`/accounts/${id}`, { method: 'PATCH', body: payload }),
	deleteAccount: (id) => request(`/accounts/${id}`, { method: 'DELETE' }),
	listCategories: () => request('/categories'),
	createCategory: (payload) => request('/categories', { method: 'POST', body: payload }),
	updateCategory: (id, payload) => request(`/categories/${id}`, { method: 'PATCH', body: payload }),
	deleteCategory: (id) => request(`/categories/${id}`, { method: 'DELETE' }),
	listTransactions: ({ month }) =>
		request(`/transactions${month ? `?month=${month}` : ''}`),
	createTransaction: (payload) => request('/transactions', { method: 'POST', body: payload }),
	getTransaction: (id) => request(`/transactions/${id}`),
	updateTransaction: (id, payload) => request(`/transactions/${id}`, { method: 'PATCH', body: payload }),
	deleteTransaction: (id) => request(`/transactions/${id}`, { method: 'DELETE' }),
	getTransactionSuggestions: () => request('/transactions/suggestions'),
	getAnalyticsSummary: () => request('/analytics/summary'),
	getAnalyticsMonthly: () => request('/analytics/monthly'),
	getAnalyticsByCategory: ({ month }) =>
		request(`/analytics/categories${month ? `?month=${month}` : ''}`),
	getSankey: () => request('/analytics/sankey'),
	uploadPayPay: (formData) =>
		request('/imports/paypay', { method: 'POST', body: formData }),
	loadImportRows: (importId) => request(`/imports/${importId}`),
	confirmImport: (importId, rows) =>
		request(`/imports/${importId}/confirm`, { method: 'POST', body: { rows } }),
	downloadBackup: async () => {
		const response = await fetch('/api/backup');
		if (!response.ok) {
			throw new Error('バックアップの取得に失敗しました');
		}
		return response;
	},
};
