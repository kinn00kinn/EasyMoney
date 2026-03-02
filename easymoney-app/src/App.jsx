import dayjs from 'dayjs';
import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
	ListMinus, Wallet, LayoutGrid, BarChart3, Download, MoreHorizontal,
} from 'lucide-react';
import { TransactionForm } from './components/TransactionForm.jsx';
import { MobileTransactionForm } from './components/MobileTransactionForm.jsx';
import { TransactionsTable } from './components/TransactionsTable.jsx';
import { TransactionsBulkEditor } from './components/TransactionsBulkEditor.jsx';
import { TransactionDetail } from './components/TransactionDetail.jsx';
import { AccountsPanel } from './components/AccountsPanel.jsx';
import { AnalyticsPanel } from './components/AnalyticsPanel.jsx';
import { ImportPanel } from './components/ImportPanel.jsx';
import { BackupPanel } from './components/BackupPanel.jsx';
import { TransactionsFilters } from './components/TransactionsFilters.jsx';
import { CommandPalette } from './components/CommandPalette.jsx';
import { api } from './lib/api.js';
import { formatCurrency } from './lib/format.js';
import './App.css';

const MOBILE_BREAKPOINT = 768;

function useIsMobile() {
	const [isMobile, setIsMobile] = useState(() =>
		typeof window !== 'undefined' && window.innerWidth <= MOBILE_BREAKPOINT
	);
	useEffect(() => {
		const mq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`);
		const handler = (e) => setIsMobile(e.matches);
		mq.addEventListener('change', handler);
		setIsMobile(mq.matches);
		return () => mq.removeEventListener('change', handler);
	}, []);
	return isMobile;
}

const ICON_SIZE = 16;

const tabs = [
	{ id: 'transactions', label: '取引', icon: ListMinus },
	{ id: 'accounts', label: '口座', icon: Wallet },
	{ id: 'categories', label: 'カテゴリ', icon: LayoutGrid },
	{ id: 'analytics', label: '分析', icon: BarChart3 },
	{ id: 'import', label: '取込', icon: Download },
	{ id: 'backup', label: 'その他', icon: MoreHorizontal },
];

function App() {
	const [activeTab, setActiveTab] = useState('transactions');
	const [accountForm, setAccountForm] = useState({ name: '', type: 'cash', note: '' });
	const [editingAccountId, setEditingAccountId] = useState(null);
	const [categoryForm, setCategoryForm] = useState({ name: '', kind: 'expense' });
	const [editingCategoryId, setEditingCategoryId] = useState(null);
	const [selectedTransactionId, setSelectedTransactionId] = useState(null);
	const [monthFilter, setMonthFilter] = useState(dayjs().format('YYYY-MM'));
	const [analyticsMonth, setAnalyticsMonth] = useState(dayjs().format('YYYY-MM'));
	const [transactionFilters, setTransactionFilters] = useState({ search: '', accountId: '', direction: 'all' });
	const [listEditMode, setListEditMode] = useState(false);
	const [bulkSelection, setBulkSelection] = useState([]);
	const [bulkError, setBulkError] = useState('');
	const [bulkApplying, setBulkApplying] = useState(false);
	const [isCommandOpen, setCommandOpen] = useState(false);
	const queryClient = useQueryClient();

	const { data: accountsResponse } = useQuery({ queryKey: ['accounts'], queryFn: api.listAccounts });
	const { data: categoriesResponse } = useQuery({ queryKey: ['categories'], queryFn: api.listCategories });
	const { data: transactionsResponse, isLoading: loadingTransactions } = useQuery({
		queryKey: ['transactions', monthFilter || 'all'],
		queryFn: () => api.listTransactions({ month: monthFilter || undefined }),
	});
	const analyticsSummaryKey = analyticsMonth ? ['analytics-summary', analyticsMonth] : ['analytics-summary', 'current'];
	const { data: summaryResponse } = useQuery({
		queryKey: analyticsSummaryKey,
		queryFn: () => api.getAnalyticsSummary({ month: analyticsMonth === 'all' ? 'all' : analyticsMonth || undefined }),
	});
	const { data: monthlyResponse } = useQuery({ queryKey: ['analytics-monthly'], queryFn: api.getAnalyticsMonthly });
	const { data: categoryAnalyticsResponse } = useQuery({
		queryKey: ['analytics-categories', analyticsMonth || 'current'],
		queryFn: () => api.getAnalyticsByCategory({ month: analyticsMonth === 'all' ? 'all' : analyticsMonth || undefined }),
	});
	const { data: flowsResponse } = useQuery({
		queryKey: ['analytics-flows', analyticsMonth || 'current'],
		queryFn: () => api.getAnalyticsFlows({ month: analyticsMonth === 'all' ? 'all' : analyticsMonth || undefined }),
	});
	const { data: suggestionResponse } = useQuery({ queryKey: ['transaction-suggestions'], queryFn: api.getTransactionSuggestions });

	const accounts = accountsResponse?.data ?? [];
	const categories = categoriesResponse?.data ?? [];
	const transactions = transactionsResponse?.data ?? [];
	const summary = summaryResponse?.data;
	const monthly = monthlyResponse?.data ?? [];
	const categoryAnalytics = categoryAnalyticsResponse?.data ?? [];
	const flows = flowsResponse?.data ?? { flows: [], paymentMethods: [] };
	const transactionSuggestions = suggestionResponse?.data ?? {};
	const activeTabMeta = tabs.find((t) => t.id === activeTab) ?? tabs[0];
	const filteredTransactions = useMemo(() => {
		const search = transactionFilters.search.trim().toLowerCase();
		return transactions.filter((tx) => {
			if (transactionFilters.accountId && tx.accountId !== transactionFilters.accountId) return false;
			if (transactionFilters.direction !== 'all' && tx.direction !== transactionFilters.direction) return false;
			if (!search) return true;
			const haystack = [
				tx.description ?? '',
				tx.memo ?? '',
				tx.categoryName ?? '',
				tx.accountName ?? '',
			]
				.join(' ')
				.toLowerCase();
			return haystack.includes(search);
		});
	}, [transactions, transactionFilters]);

	useEffect(() => {
		setBulkSelection((prev) => prev.filter((id) => transactions.some((tx) => tx.id === id)));
	}, [transactions]);

	useEffect(() => {
		const handler = (event) => {
			if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
				event.preventDefault();
				setCommandOpen(true);
			}
		};
		window.addEventListener('keydown', handler);
		return () => window.removeEventListener('keydown', handler);
	}, []);

	useEffect(() => {
		if (activeTab !== 'transactions' && listEditMode) {
			setListEditMode(false);
			setBulkSelection([]);
			setBulkError('');
		}
	}, [activeTab, listEditMode]);

	const headerMetrics = [
		{ label: '収入', value: summary?.month?.income ?? 0, tone: 'positive', filter: 'income' },
		{ label: '支出', value: summary?.month?.expense ?? 0, tone: 'negative', filter: 'expense' },
		{ label: '収支', value: summary?.month?.net ?? 0, tone: (summary?.month?.net ?? 0) >= 0 ? 'positive' : 'negative', filter: 'all' },
	];
	const commandActions = [
		{
			id: 'focus-entry',
			label: '取引入力フォームにフォーカス',
			description: 'すぐに記録を始める',
			run: () => {
				setActiveTab('transactions');
				focusTransactionForm();
			},
		},
		{
			id: 'open-transactions',
			label: '取引タブに移動',
			description: '一覧と入力',
			run: () => setActiveTab('transactions'),
		},
		{
			id: 'toggle-list-edit',
			label: 'リスト編集モードを切り替え',
			description: '複数取引を一括編集',
			run: () => handleListEditToggle(),
		},
		{
			id: 'goto-accounts',
			label: '口座タブに移動',
			run: () => setActiveTab('accounts'),
		},
		{
			id: 'goto-categories',
			label: 'カテゴリタブに移動',
			run: () => setActiveTab('categories'),
		},
		{
			id: 'goto-import',
			label: 'CSV 取込を開く',
			run: () => setActiveTab('import'),
		},
		{
			id: 'goto-backup',
			label: 'バックアップを開く',
			run: () => setActiveTab('backup'),
		},
		{
			id: 'goto-analytics',
			label: '分析タブを開く',
			run: () => setActiveTab('analytics'),
		},
		{
			id: 'filter-income',
			label: '収入のみ表示',
			run: () => {
				setActiveTab('transactions');
				handleTransactionFiltersChange({ direction: 'income' });
			},
		},
		{
			id: 'filter-expense',
			label: '支出のみ表示',
			run: () => {
				setActiveTab('transactions');
				handleTransactionFiltersChange({ direction: 'expense' });
			},
		},
		{
			id: 'clear-filters',
			label: '取引フィルタをリセット',
			run: () => resetTransactionFilters(),
		},
		{
			id: 'filter-current-month',
			label: '対象月を今月に戻す',
			run: () => handleMonthFilterChange(dayjs().format('YYYY-MM')),
		},
	];

	const invalidate = (keys) => {
		keys.filter(Boolean).forEach((key) => queryClient.invalidateQueries({ queryKey: Array.isArray(key) ? key : [key] }));
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

	const transactionMutation = useMutation({ mutationFn: api.createTransaction, onSuccess: () => refreshBookkeeping() });

	const resetAccountForm = () => setAccountForm({ name: '', type: 'cash', note: '' });

	const accountMutation = useMutation({
		mutationFn: api.createAccount,
		onSuccess: () => { invalidate([['accounts']]); resetAccountForm(); },
	});
	const accountUpdateMutation = useMutation({
		mutationFn: ({ id, data }) => api.updateAccount(id, data),
		onSuccess: () => { invalidate([['accounts']]); resetAccountForm(); setEditingAccountId(null); },
	});
	const accountDeleteMutation = useMutation({
		mutationFn: (id) => api.deleteAccount(id),
		onSuccess: (_data, deletedId) => {
			invalidate([['accounts']]);
			setEditingAccountId((c) => { if (c === deletedId) { resetAccountForm(); return null; } return c; });
		},
	});

	const resetCategoryForm = () => setCategoryForm({ name: '', kind: 'expense' });

	const categoryMutation = useMutation({
		mutationFn: api.createCategory,
		onSuccess: () => { invalidate([['categories'], ['analytics-categories']]); resetCategoryForm(); },
	});
	const categoryUpdateMutation = useMutation({
		mutationFn: ({ id, data }) => api.updateCategory(id, data),
		onSuccess: () => { invalidate([['categories'], ['analytics-categories']]); resetCategoryForm(); setEditingCategoryId(null); },
	});
	const categoryDeleteMutation = useMutation({
		mutationFn: (id) => api.deleteCategory(id),
		onSuccess: (_data, deletedId) => {
			invalidate([['categories'], ['analytics-categories']]);
			setEditingCategoryId((c) => { if (c === deletedId) { resetCategoryForm(); return null; } return c; });
		},
	});

	const handleTransactionSubmit = (values, reset) => {
		transactionMutation.mutate({ ...values, amount: Number(values.amount) }, { onSuccess: () => reset?.() });
	};

	const handleAccountSubmit = (e) => {
		e.preventDefault();
		if (!accountForm.name) return;
		const payload = { name: accountForm.name, type: accountForm.type, note: accountForm.note };
		editingAccountId ? accountUpdateMutation.mutate({ id: editingAccountId, data: payload }) : accountMutation.mutate(payload);
	};

	const handleAccountEdit = (a) => { setEditingAccountId(a.id); setAccountForm({ name: a.name, type: a.type, note: a.note ?? '' }); };
	const handleAccountDelete = (a) => {
		if (accountDeleteMutation.isPending) return;
		if (!window.confirm(`${a.name} を削除します。関連する取引が無い場合のみ削除できます。`)) return;
		accountDeleteMutation.mutate(a.id);
	};
	const handleAccountCancel = () => { setEditingAccountId(null); resetAccountForm(); };

	const handleCategorySubmit = (e) => {
		e.preventDefault();
		if (!categoryForm.name) return;
		const payload = { name: categoryForm.name, kind: categoryForm.kind };
		editingCategoryId ? categoryUpdateMutation.mutate({ id: editingCategoryId, data: payload }) : categoryMutation.mutate(payload);
	};
	const handleCategoryEdit = (c) => { setEditingCategoryId(c.id); setCategoryForm({ name: c.name, kind: c.kind }); };
	const handleCategoryDelete = (c) => {
		if (categoryDeleteMutation.isPending) return;
		if (!window.confirm(`${c.name} を削除しますか？`)) return;
		categoryDeleteMutation.mutate(c.id);
	};
	const handleCategoryCancel = () => { setEditingCategoryId(null); resetCategoryForm(); };

	const resetTransactionFilters = () => setTransactionFilters({ search: '', accountId: '', direction: 'all' });
	const handleTransactionFiltersChange = (next) => {
		setTransactionFilters((prev) => ({ ...prev, ...next }));
	};
	const handleMetricShortcut = (direction) => {
		if (activeTab !== 'transactions') {
			setActiveTab('transactions');
		}
		handleTransactionFiltersChange({ direction });
	};

	const enterListEditMode = () => {
		setListEditMode(true);
		setSelectedTransactionId(null);
		setBulkSelection([]);
		setBulkError('');
	};
	const exitListEditMode = () => {
		setListEditMode(false);
		setBulkSelection([]);
		setBulkError('');
	};
	const handleListEditToggle = () => {
		if (listEditMode) {
			exitListEditMode();
		} else {
			enterListEditMode();
		}
	};
	const handleToggleTransactionSelection = (id) => {
		setBulkSelection((prev) => (prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id]));
	};
	const handleToggleSelectAll = (checked) => {
		if (!checked) {
			setBulkSelection([]);
			return;
		}
		setBulkSelection(transactions.map((transaction) => transaction.id));
	};
	const handleBulkApply = async (patch) => {
		if (!bulkSelection.length) {
			setBulkError('取引を選択してください');
			return;
		}
		if (patch.direction === 'transfer') {
			const conflict = transactions.find(
				(transaction) => bulkSelection.includes(transaction.id) && transaction.accountId === patch.counterAccountId,
			);
			if (conflict) {
				setBulkError('振替元と振替先が同じ取引が含まれています');
				return;
			}
		}
		setBulkApplying(true);
		setBulkError('');
		const payload = {
			direction: patch.direction,
			categoryId: patch.direction === 'transfer' ? null : patch.categoryId,
			counterAccountId: patch.direction === 'transfer' ? patch.counterAccountId : null,
		};
		try {
			await api.bulkUpdateTransactions({ ids: bulkSelection, patch: payload });
			refreshBookkeeping();
			setBulkSelection([]);
		} catch (error) {
			setBulkError(error.message);
		} finally {
			setBulkApplying(false);
		}
	};

	const categoryCounts = useMemo(() => categories.map((c) => ({ ...c, total: c.total ?? 0 })), [categories]);
	const handleMonthFilterChange = (v) => {
		setMonthFilter(v);
		setSelectedTransactionId(null);
		setBulkSelection([]);
		resetTransactionFilters();
	};
	const handleAnalyticsMonthChange = (value) => {
		setAnalyticsMonth(value);
	};
	const focusTransactionForm = () => {
		requestAnimationFrame(() => {
			const amountInput = document.querySelector('[data-transaction-form] input[name="amount"]');
			amountInput?.focus();
		});
	};
	const openCommandPalette = () => setCommandOpen(true);
	const closeCommandPalette = () => setCommandOpen(false);

	const isMobile = useIsMobile();

	const renderTransactions = () => (
		<>
			{isMobile ? (
				<div className="panel">
					<div className="panel-header"><p className="panel-title">取引入力</p></div>
					<MobileTransactionForm
						accounts={accounts} categories={categories}
						onSubmit={handleTransactionSubmit}
						isSubmitting={transactionMutation.isPending}
						suggestions={transactionSuggestions}
					/>
				</div>
			) : (
				<TransactionForm accounts={accounts} categories={categories} onSubmit={handleTransactionSubmit} isSubmitting={transactionMutation.isPending} suggestions={transactionSuggestions} />
			)}
			<MonthFilterControls value={monthFilter} onChange={handleMonthFilterChange} />
			<TransactionsFilters
				accounts={accounts}
				filters={transactionFilters}
				onChange={handleTransactionFiltersChange}
				onReset={resetTransactionFilters}
			/>
			<div className="transactions-toolbar">
				<div className="toolbar-meta">
					<span className="toolbar-chip">{listEditMode ? 'リスト編集モード' : '閲覧モード'}</span>
					{listEditMode && <span className="toolbar-count">{bulkSelection.length}件選択中</span>}
				</div>
				<button className="btn secondary" type="button" onClick={handleListEditToggle}>
					{listEditMode ? '編集を終了' : 'リスト編集'}
				</button>
			</div>
			{listEditMode && (
				<TransactionsBulkEditor
					count={bulkSelection.length}
					accounts={accounts}
					categories={categories}
					onApply={handleBulkApply}
					onCancel={exitListEditMode}
					isApplying={bulkApplying}
					errorMessage={bulkError}
				/>
			)}
			{loadingTransactions ? <p className="status">読み込み中…</p> : (
				<div className="transactions-layout">
					<TransactionsTable
						transactions={filteredTransactions}
						selectedId={listEditMode ? null : selectedTransactionId}
						onSelect={listEditMode ? undefined : setSelectedTransactionId}
						editMode={listEditMode}
						selection={bulkSelection}
						onToggleSelection={handleToggleTransactionSelection}
						onToggleSelectAll={handleToggleSelectAll}
					/>
					{!listEditMode && selectedTransactionId && (
						<>
							{isMobile && <div className="detail-overlay" onClick={() => setSelectedTransactionId(null)} />}
							<TransactionDetail
								transactionId={selectedTransactionId} accounts={accounts} categories={categories}
								onClose={() => setSelectedTransactionId(null)}
								onUpdated={(id) => refreshBookkeeping(id)}
								onDeleted={() => { setSelectedTransactionId(null); refreshBookkeeping(); }}
							/>
						</>
					)}
				</div>
			)}
		</>
	);

	const renderAccounts = () => (
		<>
			<AccountsPanel accounts={accounts} onEdit={handleAccountEdit} onDelete={handleAccountDelete} editingAccountId={editingAccountId} disableActions={accountDeleteMutation.isPending || accountUpdateMutation.isPending} />
			<form className="panel inline-form" onSubmit={handleAccountSubmit}>
				<div className="panel-header">
					<p className="panel-title">{editingAccountId ? '口座を編集' : '口座を追加'}</p>
					<div className="detail-actions">
						<button type="submit" className="btn primary" disabled={accountMutation.isPending || accountUpdateMutation.isPending}>
							{editingAccountId ? (accountUpdateMutation.isPending ? '更新中…' : '更新') : (accountMutation.isPending ? '追加中…' : '追加')}
						</button>
						{editingAccountId && <button type="button" className="btn" onClick={handleAccountCancel}>キャンセル</button>}
					</div>
				</div>
				<div className="form-grid">
					<label className="field"><span>名称</span><input type="text" value={accountForm.name} onChange={(e) => setAccountForm((p) => ({ ...p, name: e.target.value }))} required /></label>
					<label className="field"><span>種別</span>
						<select value={accountForm.type} onChange={(e) => setAccountForm((p) => ({ ...p, type: e.target.value }))}>
							<option value="cash">現金</option><option value="bank">銀行</option><option value="credit">クレジット</option>
						</select>
					</label>
					<label className="field"><span>メモ</span><input type="text" value={accountForm.note} onChange={(e) => setAccountForm((p) => ({ ...p, note: e.target.value }))} placeholder="任意" /></label>
				</div>
				{accountUpdateMutation.isError && <p className="status error">{accountUpdateMutation.error?.message}</p>}
				{accountDeleteMutation.isError && <p className="status error">{accountDeleteMutation.error?.message}</p>}
			</form>
		</>
	);

	const renderCategories = () => (
		<>
			<div className="panel">
				<div className="panel-header"><p className="panel-title">カテゴリ一覧</p></div>
				<div className="table-scroll">
					<table>
						<thead><tr><th>名称</th><th>区分</th><th className="align-right">累計</th><th>操作</th></tr></thead>
						<tbody>
							{categoryCounts.map((c) => (
								<tr key={c.id} data-editing={c.id === editingCategoryId}>
									<td>{c.name}</td>
									<td>{c.kind === 'income' ? '収入' : c.kind === 'expense' ? '支出' : '振替'}</td>
									<td className="align-right">{formatCurrency(c.total)}</td>
									<td>
										<div className="category-actions">
											<button className="btn secondary" type="button" onClick={() => handleCategoryEdit(c)}>編集</button>
											<button className="btn danger" type="button" onClick={() => handleCategoryDelete(c)}>削除</button>
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
					<p className="panel-title">{editingCategoryId ? 'カテゴリを編集' : 'カテゴリを追加'}</p>
					<div className="detail-actions">
						<button type="submit" className="btn primary" disabled={categoryMutation.isPending || categoryUpdateMutation.isPending}>
							{editingCategoryId ? (categoryUpdateMutation.isPending ? '更新中…' : '更新') : (categoryMutation.isPending ? '追加中…' : '追加')}
						</button>
						{editingCategoryId && <button type="button" className="btn" onClick={handleCategoryCancel}>キャンセル</button>}
					</div>
				</div>
				<div className="form-grid">
					<label className="field"><span>名称</span><input type="text" value={categoryForm.name} onChange={(e) => setCategoryForm((p) => ({ ...p, name: e.target.value }))} required /></label>
					<label className="field"><span>区分</span>
						<select value={categoryForm.kind} onChange={(e) => setCategoryForm((p) => ({ ...p, kind: e.target.value }))}>
							<option value="expense">支出</option><option value="income">収入</option><option value="transfer">振替</option>
						</select>
					</label>
				</div>
				{categoryUpdateMutation.isError && <p className="status error">{categoryUpdateMutation.error?.message}</p>}
				{categoryDeleteMutation.isError && <p className="status error">{categoryDeleteMutation.error?.message}</p>}
			</form>
		</>
	);

	const renderAnalytics = () => (
		<AnalyticsPanel
			summary={summary}
			monthly={monthly}
			categories={categoryAnalytics}
			flows={flows}
			selectedMonth={analyticsMonth}
			onSelectMonth={handleAnalyticsMonthChange}
			availableMonths={monthly.map((row) => row.month)}
		/>
	);

	const renderContent = () => {
		switch (activeTab) {
			case 'accounts': return renderAccounts();
			case 'categories': return renderCategories();
			case 'analytics': return renderAnalytics();
			case 'import': return <ImportPanel accounts={accounts} categories={categories} onImported={() => refreshBookkeeping()} />;
			case 'backup': return <BackupPanel />;
			default: return renderTransactions();
		}
	};

	return (
		<div className="app-shell">
			<aside className="sidebar">
				<div className="sidebar-brand">
					<div className="logo-mark">EM</div>
					<p className="app-name">EasyMoney</p>
				</div>
				<nav className="sidebar-nav" aria-label="メニュー">
					{tabs.map((tab) => {
						const Icon = tab.icon;
						return (
							<button
								key={tab.id} className="sidebar-nav-item" type="button"
								onClick={() => setActiveTab(tab.id)}
								data-active={tab.id === activeTab}
								aria-current={tab.id === activeTab ? 'page' : undefined}
							>
								<Icon size={ICON_SIZE} className="nav-icon" />
								<span className="nav-label">{tab.label}</span>
							</button>
						);
					})}
				</nav>
				<div className="sidebar-meta">
					<p className="sidebar-date">{dayjs().format('YYYY/MM/DD')}</p>
				</div>
			</aside>

			<div className="main-area">
				<header className="app-header">
					<div>
						<h1>{activeTabMeta.label}</h1>
					</div>
					<div className="header-actions">
						<div className="header-metrics">
							{headerMetrics.map((m) => (
								<button
									type="button"
									key={m.label}
									className={`metric-card ${m.tone}`}
									onClick={() => handleMetricShortcut(m.filter)}
								>
									<p className="metric-label">{m.label}</p>
									<p className="metric-value">{formatCurrency(m.value)}</p>
								</button>
							))}
						</div>
						<button className="btn ghost command-btn" type="button" onClick={openCommandPalette}>
							<span>コマンド</span>
							<kbd>⌘K</kbd>
						</button>
					</div>
				</header>
				<main className="content">{renderContent()}</main>
			</div>

			<nav className="mobile-nav" aria-label="メニュー">
				<div className="mobile-nav-inner">
					{tabs.map((tab) => {
						const Icon = tab.icon;
						return (
							<button
								key={tab.id} className="mobile-nav-item" type="button"
								onClick={() => setActiveTab(tab.id)}
								data-active={tab.id === activeTab}
							>
								<Icon size={20} className="nav-icon" />
								<span>{tab.label}</span>
							</button>
						);
					})}
				</div>
			</nav>
			{isMobile && activeTab !== 'transactions' && (
				<button
					className="fab"
					type="button"
					onClick={() => {
						setActiveTab('transactions');
						focusTransactionForm();
					}}
					aria-label="取引を追加"
				>
					+
				</button>
			)}
			<CommandPalette open={isCommandOpen} onClose={closeCommandPalette} actions={commandActions} />
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
				<input type="month" value={value} onChange={(e) => onChange(e.target.value)} />
			</label>
			<div className="filter-actions">
				<button className="btn" type="button" onClick={() => onChange(currentMonth)}>今月</button>
				<button className="btn" type="button" onClick={() => onChange(previousMonth)}>先月</button>
				<button className="btn" type="button" onClick={() => onChange('')} disabled={!value}>クリア</button>
			</div>
		</div>
	);
}
