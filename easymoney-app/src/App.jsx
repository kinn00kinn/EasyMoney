import dayjs from 'dayjs';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { TransactionForm } from './components/TransactionForm.jsx';
import { TransactionsTable } from './components/TransactionsTable.jsx';
import { TransactionDetail } from './components/TransactionDetail.jsx';
import { AccountsPanel } from './components/AccountsPanel.jsx';
import { AnalyticsPanel } from './components/AnalyticsPanel.jsx';
import { ImportPanel } from './components/ImportPanel.jsx';
import { BackupPanel } from './components/BackupPanel.jsx';
import { api } from './lib/api.js';
import { formatCurrency } from './lib/format.js';
import './App.css';

const tabs = [
	{ id: 'transactions', label: '取引', fullLabel: '取引入力', description: '仕訳を意識せずに素早く登録します。' },
	{ id: 'accounts', label: '口座', fullLabel: '口座', description: '口座残高と支払い手段を整理します。' },
	{ id: 'categories', label: 'カテゴリ', fullLabel: 'カテゴリ', description: '費目や区分を整えて入力を効率化します。' },
	{ id: 'analytics', label: '分析', fullLabel: '分析', description: '月次の推移とカテゴリ別の傾向をチェックします。' },
	{ id: 'import', label: '取込', fullLabel: 'CSV取込', description: 'PayPay銀などの CSV を取り込みます。' },
	{ id: 'backup', label: 'その他', fullLabel: 'バックアップ', description: 'データを安全にエクスポートします。' },
];

function App() {
	const [activeTab, setActiveTab] = useState('transactions');
	const [accountForm, setAccountForm] = useState({ name: '', type: 'cash', note: '' });
	const [editingAccountId, setEditingAccountId] = useState(null);
	const [categoryForm, setCategoryForm] = useState({ name: '', kind: 'expense' });
	const [editingCategoryId, setEditingCategoryId] = useState(null);
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
	const activeTabMeta = tabs.find((tab) => tab.id === activeTab) ?? tabs[0];
	const headerMetrics = [
		{ label: '今月の収入', value: summary?.month?.income ?? 0, tone: 'positive' },
		{ label: '今月の支出', value: summary?.month?.expense ?? 0, tone: 'negative' },
		{
			label: '収支',
			value: summary?.month?.net ?? 0,
			tone: (summary?.month?.net ?? 0) >= 0 ? 'positive' : 'negative',
		},
	];
	const today = dayjs().format('YYYY/MM/DD');

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

	const resetAccountForm = () => {
		setAccountForm({ name: '', type: 'cash', note: '' });
	};

	const accountMutation = useMutation({
		mutationFn: api.createAccount,
		onSuccess: () => {
			invalidate([['accounts']]);
			resetAccountForm();
		},
	});

	const accountUpdateMutation = useMutation({
		mutationFn: ({ id, data }) => api.updateAccount(id, data),
		onSuccess: () => {
			invalidate([['accounts']]);
			resetAccountForm();
			setEditingAccountId(null);
		},
	});

	const accountDeleteMutation = useMutation({
		mutationFn: (id) => api.deleteAccount(id),
		onSuccess: (_data, deletedId) => {
			invalidate([['accounts']]);
			setEditingAccountId((current) => {
				if (current === deletedId) {
					resetAccountForm();
					return null;
				}
				return current;
			});
		},
	});

	const resetCategoryForm = () => setCategoryForm({ name: '', kind: 'expense' });

	const categoryMutation = useMutation({
		mutationFn: api.createCategory,
		onSuccess: () => {
			invalidate([['categories'], ['analytics-categories']]);
			resetCategoryForm();
		},
	});

	const categoryUpdateMutation = useMutation({
		mutationFn: ({ id, data }) => api.updateCategory(id, data),
		onSuccess: () => {
			invalidate([['categories'], ['analytics-categories']]);
			resetCategoryForm();
			setEditingCategoryId(null);
		},
	});

	const categoryDeleteMutation = useMutation({
		mutationFn: (id) => api.deleteCategory(id),
		onSuccess: (_data, deletedId) => {
			invalidate([['categories'], ['analytics-categories']]);
			setEditingCategoryId((current) => {
				if (current === deletedId) {
					resetCategoryForm();
					return null;
				}
				return current;
			});
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
		const payload = {
			name: accountForm.name,
			type: accountForm.type,
			note: accountForm.note,
		};
		if (editingAccountId) {
			accountUpdateMutation.mutate({ id: editingAccountId, data: payload });
		} else {
			accountMutation.mutate(payload);
		}
	};

	const handleAccountEdit = (account) => {
		setEditingAccountId(account.id);
		setAccountForm({
			name: account.name,
			type: account.type,
			note: account.note ?? '',
		});
	};

	const handleAccountDelete = (account) => {
		if (accountDeleteMutation.isPending) return;
		if (!window.confirm(`${account.name} を削除します。関連する取引が無い場合のみ削除できます。`)) {
			return;
		}
		accountDeleteMutation.mutate(account.id);
	};

	const handleAccountCancel = () => {
		setEditingAccountId(null);
		resetAccountForm();
	};

	const handleCategorySubmit = (event) => {
		event.preventDefault();
		if (!categoryForm.name) return;
		const payload = {
			name: categoryForm.name,
			kind: categoryForm.kind,
		};
		if (editingCategoryId) {
			categoryUpdateMutation.mutate({ id: editingCategoryId, data: payload });
		} else {
			categoryMutation.mutate(payload);
		}
	};

	const handleCategoryEdit = (category) => {
		setEditingCategoryId(category.id);
		setCategoryForm({
			name: category.name,
			kind: category.kind,
		});
	};

	const handleCategoryDelete = (category) => {
		if (categoryDeleteMutation.isPending) return;
		if (!window.confirm(`${category.name} を削除しますか？このカテゴリを利用中の取引があると削除できません。`)) {
			return;
		}
		categoryDeleteMutation.mutate(category.id);
	};

	const handleCategoryCancel = () => {
		setEditingCategoryId(null);
		resetCategoryForm();
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
							onDeleted={() => {
								setSelectedTransactionId(null);
								refreshBookkeeping();
							}}
						/>
					) : null}
				</div>
			)}
		</>
	);

	const renderAccounts = () => (
		<>
			<AccountsPanel
				accounts={accounts}
				onEdit={handleAccountEdit}
				onDelete={handleAccountDelete}
				editingAccountId={editingAccountId}
				disableActions={accountDeleteMutation.isPending || accountUpdateMutation.isPending}
			/>
			<form className="panel inline-form" onSubmit={handleAccountSubmit}>
				<div className="panel-header">
					<div>
						<p className="panel-title">{editingAccountId ? '口座を編集' : '口座を追加'}</p>
					</div>
					<div className="detail-actions">
						<button
							type="submit"
							className="btn primary"
							disabled={
								accountMutation.isPending || accountUpdateMutation.isPending || accountDeleteMutation.isPending
							}
						>
							{editingAccountId
								? accountUpdateMutation.isPending
									? '更新中…'
									: '更新'
								: accountMutation.isPending
									? '追加中…'
									: '追加'}
						</button>
						{editingAccountId ? (
							<button
								type="button"
								className="btn secondary"
								onClick={handleAccountCancel}
								disabled={accountUpdateMutation.isPending}
							>
								キャンセル
							</button>
						) : null}
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
					<label className="field">
						<span>メモ</span>
						<input
							type="text"
							value={accountForm.note}
							onChange={(event) => setAccountForm((prev) => ({ ...prev, note: event.target.value }))}
							placeholder="任意"
						/>
					</label>
				</div>
				{accountUpdateMutation.isError ? <p className="status error">{accountUpdateMutation.error?.message}</p> : null}
				{accountDeleteMutation.isError ? <p className="status error">{accountDeleteMutation.error?.message}</p> : null}
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
								<th>操作</th>
							</tr>
						</thead>
						<tbody>
							{categoryCounts.map((category) => (
								<tr key={category.id} data-editing={category.id === editingCategoryId}>
									<td>{category.name}</td>
									<td>{category.kind === 'income' ? '収入' : category.kind === 'expense' ? '支出' : '振替'}</td>
									<td className="align-right">{formatCurrency(category.total)}</td>
									<td>
										<div className="category-actions">
											<button className="btn secondary" type="button" onClick={() => handleCategoryEdit(category)} disabled={categoryUpdateMutation.isPending}>
												編集
											</button>
											<button className="btn danger" type="button" onClick={() => handleCategoryDelete(category)} disabled={categoryDeleteMutation.isPending}>
												削除
											</button>
										</div>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</div>
			<form className="panel inline-form" onSubmit={handleCategorySubmit}>
				<div className="panel-header">
					<div>
						<p className="panel-title">{editingCategoryId ? 'カテゴリを編集' : 'カテゴリを追加'}</p>
					</div>
					<div className="detail-actions">
						<button
							type="submit"
							className="btn primary"
							disabled={
								categoryMutation.isPending || categoryUpdateMutation.isPending || categoryDeleteMutation.isPending
							}
						>
							{editingCategoryId
								? categoryUpdateMutation.isPending
									? '更新中…'
									: '更新'
								: categoryMutation.isPending
									? '追加中…'
									: '追加'}
						</button>
						{editingCategoryId ? (
							<button
								type="button"
								className="btn secondary"
								onClick={handleCategoryCancel}
								disabled={categoryUpdateMutation.isPending}
							>
								キャンセル
							</button>
						) : null}
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
				{categoryUpdateMutation.isError ? <p className="status error">{categoryUpdateMutation.error?.message}</p> : null}
				{categoryDeleteMutation.isError ? <p className="status error">{categoryDeleteMutation.error?.message}</p> : null}
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

	const renderBackup = () => <BackupPanel />;

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
			case 'backup':
				return renderBackup();
			default:
				return renderTransactions();
		}
	};

	return (
		<div className="app-shell">
			{/* Desktop Sidebar */}
			<aside className="sidebar">
				<div className="sidebar-brand">
					<div className="logo-mark">EM</div>
					<div>
						<p className="app-name">EasyMoney</p>
						<p className="sidebar-tagline">複式簿記で守る家計</p>
					</div>
				</div>
				<nav className="sidebar-nav" aria-label="主要メニュー">
					{tabs.map((tab) => (
						<button
							key={tab.id}
							className="sidebar-nav-item"
							type="button"
							onClick={() => setActiveTab(tab.id)}
							data-active={tab.id === activeTab}
							aria-current={tab.id === activeTab ? 'page' : undefined}
						>
							<NavIcon id={tab.id} />
							<span className="nav-label">{tab.fullLabel}</span>
						</button>
					))}
				</nav>
				<div className="sidebar-meta">
					<p className="sidebar-date">{today}</p>
					<p className="sidebar-hint">Tab / Enter で操作</p>
				</div>
			</aside>

			{/* Main Content */}
			<div className="main-area">
				<header className="app-header">
					<div>
						<p className="eyebrow">EasyMoney</p>
						<h1>{activeTabMeta.fullLabel}</h1>
						<p className="app-subtitle">{activeTabMeta.description}</p>
					</div>
					<div className="header-metrics">
						{headerMetrics.map((metric) => (
							<div key={metric.label} className={`metric-card ${metric.tone}`}>
								<p className="metric-label">{metric.label}</p>
								<p className="metric-value">{formatCurrency(metric.value)}</p>
							</div>
						))}
					</div>
				</header>
				<main className="content">{renderContent()}</main>
			</div>

			{/* Mobile Bottom Navigation */}
			<nav className="mobile-nav" aria-label="モバイルメニュー">
				<div className="mobile-nav-inner">
					{tabs.map((tab) => (
						<button
							key={tab.id}
							className="mobile-nav-item"
							type="button"
							onClick={() => setActiveTab(tab.id)}
							data-active={tab.id === activeTab}
							aria-current={tab.id === activeTab ? 'page' : undefined}
						>
							<NavIcon id={tab.id} />
							<span>{tab.label}</span>
						</button>
					))}
				</div>
			</nav>
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

function NavIcon({ id }) {
	switch (id) {
		case 'transactions':
			return (
				<svg className="nav-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
					<path d="M5 7h14M5 12h10M5 17h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
				</svg>
			);
		case 'accounts':
			return (
				<svg className="nav-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
					<rect x="4" y="7" width="16" height="11" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
					<path d="M15 12h3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
				</svg>
			);
		case 'categories':
			return (
				<svg className="nav-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
					<rect x="5" y="5" width="6" height="6" rx="1.2" stroke="currentColor" strokeWidth="1.8" />
					<rect x="13" y="5" width="6" height="6" rx="1.2" stroke="currentColor" strokeWidth="1.8" />
					<rect x="5" y="13" width="14" height="6" rx="1.2" stroke="currentColor" strokeWidth="1.8" />
				</svg>
			);
		case 'analytics':
			return (
				<svg className="nav-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
					<path d="M6 16V9M12 16V5M18 16v-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
				</svg>
			);
		case 'import':
			return (
				<svg className="nav-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
					<path d="M12 5v10m0 0 3.5-3.5M12 15l-3.5-3.5M5 19h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
				</svg>
			);
		case 'backup':
			return (
				<svg className="nav-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
					<circle cx="12" cy="12" r="1.5" fill="currentColor" />
					<circle cx="12" cy="6" r="1.5" fill="currentColor" />
					<circle cx="12" cy="18" r="1.5" fill="currentColor" />
				</svg>
			);
		default:
			return (
				<svg className="nav-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
					<circle cx="12" cy="12" r="5.5" stroke="currentColor" strokeWidth="1.8" />
				</svg>
			);
	}
}
