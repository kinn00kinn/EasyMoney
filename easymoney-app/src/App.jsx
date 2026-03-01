import dayjs from 'dayjs';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { TransactionForm } from './components/TransactionForm.jsx';
import { TransactionsTable } from './components/TransactionsTable.jsx';
import { TransactionDetail } from './components/TransactionDetail.jsx';
import { AccountsPanel } from './components/AccountsPanel.jsx';
import { AnalyticsPanel } from './components/AnalyticsPanel.jsx';
import { ImportPanel } from './components/ImportPanel.jsx';
import { api } from './lib/api.js';
import { formatCurrency } from './lib/format.js';
import './App.css';

const tabs = [
	{ id: 'transactions', label: '取引入力' },
	{ id: 'accounts', label: '口座' },
	{ id: 'categories', label: 'カテゴリ' },
	{ id: 'analytics', label: '分析' },
	{ id: 'import', label: 'CSV取込' },
];

function App() {
	const [activeTab, setActiveTab] = useState('transactions');
	const [accountForm, setAccountForm] = useState({ name: '', type: 'cash' });
	const [categoryForm, setCategoryForm] = useState({ name: '', kind: 'expense' });
	const [selectedTransactionId, setSelectedTransactionId] = useState(null);
	const [monthFilter, setMonthFilter] = useState(dayjs().format('YYYY-MM'));
	const queryClient = useQueryClient();

	const { data: accountsResponse } = useQuery({ queryKey: ['accounts'], queryFn: api.listAccounts });
	const { data: categoriesResponse } = useQuery({ queryKey: ['categories'], queryFn: api.listCategories });
	const { data: transactionsResponse, isLoading: loadingTransactions } = useQuery({
		queryKey: ['transactions', monthFilter || 'all'],
		queryFn: () => api.listTransactions({ month: monthFilter || undefined }),
	});
	const { data: summaryResponse } = useQuery({ queryKey: ['analytics-summary'], queryFn: api.getAnalyticsSummary });
	const { data: monthlyResponse } = useQuery({ queryKey: ['analytics-monthly'], queryFn: api.getAnalyticsMonthly });
	const { data: categoryAnalyticsResponse } = useQuery({
		queryKey: ['analytics-categories', monthFilter || 'all'],
		queryFn: () => api.getAnalyticsByCategory({ month: monthFilter || undefined }),
	});
	const { data: sankeyResponse } = useQuery({ queryKey: ['analytics-sankey'], queryFn: api.getSankey });
	const { data: suggestionResponse } = useQuery({ queryKey: ['transaction-suggestions'], queryFn: api.getTransactionSuggestions });

	const accounts = accountsResponse?.data ?? [];
	const categories = categoriesResponse?.data ?? [];
	const transactions = transactionsResponse?.data ?? [];
	const summary = summaryResponse?.data;
	const monthly = monthlyResponse?.data ?? [];
	const categoryAnalytics = categoryAnalyticsResponse?.data ?? [];
	const sankey = sankeyResponse?.data ?? [];
	const transactionSuggestions = suggestionResponse?.data ?? {};

	const invalidate = (keys) => {
		keys
			.filter(Boolean)
			.forEach((key) => queryClient.invalidateQueries({ queryKey: Array.isArray(key) ? key : [key] }));
	};

	const refreshBookkeeping = (transactionId) => {
		invalidate([
			['transactions', monthFilter || 'all'],
			['analytics-summary'],
			['analytics-monthly'],
			['analytics-categories', monthFilter || 'all'],
			['accounts'],
			['transaction-suggestions'],
			transactionId ? ['transaction', transactionId] : null,
		]);
	};

	const transactionMutation = useMutation({
		mutationFn: api.createTransaction,
		onSuccess: () => refreshBookkeeping(),
	});

	const accountMutation = useMutation({
		mutationFn: api.createAccount,
		onSuccess: () => {
			invalidate([['accounts']]);
			setAccountForm({ name: '', type: 'cash' });
		},
	});

	const categoryMutation = useMutation({
		mutationFn: api.createCategory,
		onSuccess: () => {
			invalidate([['categories'], ['analytics-categories']]);
			setCategoryForm({ name: '', kind: 'expense' });
		},
	});

	const handleTransactionSubmit = (values, reset) => {
		transactionMutation.mutate(
			{
				...values,
				amount: Number(values.amount),
			},
			{
				onSuccess: () => reset?.(),
			},
		);
	};

	const handleAccountSubmit = (event) => {
		event.preventDefault();
		if (!accountForm.name) return;
		accountMutation.mutate({
			name: accountForm.name,
			type: accountForm.type,
		});
	};

	const handleCategorySubmit = (event) => {
		event.preventDefault();
		if (!categoryForm.name) return;
		categoryMutation.mutate({
			name: categoryForm.name,
			kind: categoryForm.kind,
		});
	};

	const categoryCounts = useMemo(
		() =>
			categories.map((category) => ({
				...category,
				total: category.total ?? 0,
			})),
		[categories],
	);

	const handleMonthFilterChange = (value) => {
		setMonthFilter(value);
		setSelectedTransactionId(null);
	};

	const renderTransactions = () => (
		<>
			<TransactionForm
				accounts={accounts}
				categories={categories}
				onSubmit={handleTransactionSubmit}
				isSubmitting={transactionMutation.isPending}
				suggestions={transactionSuggestions}
			/>
			<MonthFilterControls value={monthFilter} onChange={handleMonthFilterChange} />
			{loadingTransactions ? (
				<p className="status">読み込み中…</p>
			) : (
				<div className="transactions-layout">
					<TransactionsTable
						transactions={transactions}
						selectedId={selectedTransactionId}
						onSelect={setSelectedTransactionId}
					/>
					{selectedTransactionId ? (
						<TransactionDetail
							transactionId={selectedTransactionId}
							accounts={accounts}
							categories={categories}
							onClose={() => setSelectedTransactionId(null)}
							onUpdated={(id) => refreshBookkeeping(id)}
						/>
					) : null}
				</div>
			)}
		</>
	);

	const renderAccounts = () => (
		<>
			<AccountsPanel accounts={accounts} />
			<form className="panel inline-form" onSubmit={handleAccountSubmit}>
				<div className="panel-header">
					<div>
						<p className="panel-title">口座を追加</p>
					</div>
					<div>
						<button type="submit" className="btn primary" disabled={accountMutation.isPending}>
							追加
						</button>
					</div>
				</div>
				<div className="form-grid">
					<label className="field">
						<span>名称</span>
						<input
							type="text"
							value={accountForm.name}
							onChange={(event) => setAccountForm((prev) => ({ ...prev, name: event.target.value }))}
							required
						/>
					</label>
					<label className="field">
						<span>種別</span>
						<select value={accountForm.type} onChange={(event) => setAccountForm((prev) => ({ ...prev, type: event.target.value }))}>
							<option value="cash">現金</option>
							<option value="bank">銀行</option>
							<option value="credit">クレジット</option>
						</select>
					</label>
				</div>
			</form>
		</>
	);

	const renderCategories = () => (
		<>
			<div className="panel">
				<div className="panel-header">
					<div>
						<p className="panel-title">カテゴリ一覧</p>
					</div>
				</div>
				<div className="table-scroll">
					<table>
						<thead>
							<tr>
								<th>名称</th>
								<th>区分</th>
								<th className="align-right">累計</th>
							</tr>
						</thead>
						<tbody>
							{categoryCounts.map((category) => (
								<tr key={category.id}>
									<td>{category.name}</td>
									<td>{category.kind === 'income' ? '収入' : category.kind === 'expense' ? '支出' : '振替'}</td>
									<td className="align-right">{formatCurrency(category.total)}</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</div>
			<form className="panel inline-form" onSubmit={handleCategorySubmit}>
				<div className="panel-header">
					<div>
						<p className="panel-title">カテゴリを追加</p>
					</div>
					<div>
						<button type="submit" className="btn primary" disabled={categoryMutation.isPending}>
							追加
						</button>
					</div>
				</div>
				<div className="form-grid">
					<label className="field">
						<span>名称</span>
						<input
							type="text"
							value={categoryForm.name}
							onChange={(event) => setCategoryForm((prev) => ({ ...prev, name: event.target.value }))}
							required
						/>
					</label>
					<label className="field">
						<span>区分</span>
						<select value={categoryForm.kind} onChange={(event) => setCategoryForm((prev) => ({ ...prev, kind: event.target.value }))}>
							<option value="expense">支出</option>
							<option value="income">収入</option>
							<option value="transfer">振替</option>
						</select>
					</label>
				</div>
			</form>
		</>
	);

	const renderAnalytics = () => (
		<>
			<MonthFilterControls value={monthFilter} onChange={handleMonthFilterChange} />
			<AnalyticsPanel summary={summary} monthly={monthly} categories={categoryAnalytics} flows={sankey} selectedMonth={monthFilter} />
		</>
	);

	const renderImport = () => (
		<ImportPanel
			accounts={accounts}
			categories={categories}
			onImported={() => {
				refreshBookkeeping();
			}}
		/>
	);

	const renderContent = () => {
		switch (activeTab) {
			case 'accounts':
				return renderAccounts();
			case 'categories':
				return renderCategories();
			case 'analytics':
				return renderAnalytics();
			case 'import':
				return renderImport();
			default:
				return renderTransactions();
		}
	};

	return (
		<div className="layout">
			<header className="app-header">
				<div>
					<h1>EasyMoney</h1>
					<p>複式簿記で守る個人用家計簿</p>
				</div>
			</header>
			<nav className="tabs">
				{tabs.map((tab) => (
					<button key={tab.id} className={tab.id === activeTab ? 'active' : ''} type="button" onClick={() => setActiveTab(tab.id)}>
						{tab.label}
					</button>
				))}
			</nav>
			<main className="content">{renderContent()}</main>
		</div>
	);
}

export default App;

function MonthFilterControls({ value, onChange }) {
	const currentMonth = dayjs().format('YYYY-MM');
	const previousMonth = dayjs().subtract(1, 'month').format('YYYY-MM');

	return (
		<div className="filter-bar">
			<label className="field">
				<span>対象月</span>
				<input type="month" value={value} onChange={(event) => onChange(event.target.value)} />
			</label>
			<div className="filter-actions">
				<button className="btn secondary" type="button" onClick={() => onChange(currentMonth)}>
					今月
				</button>
				<button className="btn secondary" type="button" onClick={() => onChange(previousMonth)}>
					先月
				</button>
				<button className="btn" type="button" onClick={() => onChange('')} disabled={!value}>
					クリア
				</button>
			</div>
		</div>
	);
}
