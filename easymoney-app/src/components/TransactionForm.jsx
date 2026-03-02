import { useMemo, useState } from 'react';
import { today } from '../lib/format.js';

const createInitialState = () => ({
	date: today(),
	amount: '',
	description: '',
	memo: '',
	accountId: '',
	categoryId: '',
	paymentMethod: 'cash',
	direction: 'expense',
	counterAccountId: '',
});

export function TransactionForm({ accounts = [], categories = [], onSubmit, isSubmitting, suggestions = {} }) {
	const [form, setForm] = useState(() => createInitialState());
	const merchantSuggestions = suggestions.merchants ?? [];
	const categorySuggestions = suggestions.categories ?? [];
	const accountSuggestions = suggestions.accounts ?? [];
	const categoryMap = useMemo(() => new Map(categories.map((category) => [category.id, category.kind])), [categories]);
	const filteredCategories = useMemo(() => {
		if (form.direction === 'transfer') return [];
		const targetKind = form.direction === 'income' ? 'income' : 'expense';
		return categories.filter((category) => category.kind === targetKind);
	}, [categories, form.direction]);

	const resetForm = () => setForm(createInitialState());

	const handleChange = (event) => {
		const { name, value } = event.target;
		setForm((prev) => {
			if (name === 'counterAccountId' && value === prev.accountId) {
				return prev;
			}
			let next = { ...prev, [name]: value };
			if (name === 'accountId') {
				const account = accounts.find((accountItem) => accountItem.id === value);
				next.paymentMethod = account?.type ?? prev.paymentMethod;
				if (prev.counterAccountId === value) {
					next.counterAccountId = '';
				}
			}
			return next;
		});
	};

	const handleDirectionChange = (direction) => {
		setForm((prev) => {
			if (direction === 'transfer') {
				return { ...prev, direction, categoryId: '', counterAccountId: '' };
			}
			const targetKind = direction === 'income' ? 'income' : 'expense';
			const defaultCategoryId = categories.find((category) => category.kind === targetKind)?.id ?? '';
			return {
				...prev,
				direction,
				categoryId: defaultCategoryId,
				counterAccountId: '',
			};
		});
	};

	const handleSubmit = (event) => {
		event.preventDefault();
		if (!form.accountId || !form.amount || !form.description) return;
		if (form.direction === 'transfer') {
			if (!form.counterAccountId) return;
		} else if (!form.categoryId) {
			return;
		}
		const payload = {
			...form,
			categoryId: form.direction === 'transfer' ? null : form.categoryId,
			counterAccountId: form.direction === 'transfer' ? form.counterAccountId : null,
		};
		onSubmit(payload, resetForm);
	};

	const applyMerchant = (merchant) => {
		const categoryKind = merchant.categoryId ? categoryMap.get(merchant.categoryId) : null;
		const inferredDirection =
			categoryKind === 'income' ? 'income' : categoryKind === 'expense' ? 'expense' : form.direction;
		setForm((prev) => {
			const nextDirection = inferredDirection ?? prev.direction;
			const isTransfer = nextDirection === 'transfer';
			const directionKind = nextDirection === 'income' ? 'income' : 'expense';
			const merchantCategoryValid =
				!isTransfer && merchant.categoryId && categoryMap.get(merchant.categoryId) === directionKind;
			const account = merchant.accountId ? accounts.find((accountItem) => accountItem.id === merchant.accountId) : null;
			return {
				...prev,
				description: merchant.description,
				direction: nextDirection,
				categoryId: merchantCategoryValid ? merchant.categoryId : isTransfer ? '' : prev.categoryId,
				counterAccountId: isTransfer ? '' : prev.counterAccountId,
				accountId: merchant.accountId ?? prev.accountId,
				paymentMethod: account?.type ?? merchant.accountType ?? prev.paymentMethod,
			};
		});
	};

	const applyCategory = (categoryId) => {
		const kind = categoryMap.get(categoryId);
		setForm((prev) => ({
			...prev,
			direction: kind === 'income' ? 'income' : 'expense',
			categoryId,
		}));
	};

	const applyAccount = (accountId, accountType) => {
		setForm((prev) => ({
			...prev,
			accountId,
			paymentMethod: accountType ?? prev.paymentMethod,
			counterAccountId: prev.counterAccountId === accountId ? '' : prev.counterAccountId,
		}));
	};

	return (
		<form className="panel" onSubmit={handleSubmit}>
			<div className="panel-header">
				<div>
					<p className="panel-title">取引入力</p>
					<p className="panel-subtitle">手入力で素早く記録できます</p>
				</div>
				<div>
					<button type="submit" className="btn primary" disabled={isSubmitting}>
						{isSubmitting ? '保存中…' : '保存'}
					</button>
				</div>
			</div>
			<div className="direction-toggle">
				<span>区分</span>
				<div className="segmented-control">
					{['expense', 'income', 'transfer'].map((direction) => (
						<button
							type="button"
							key={direction}
							className={form.direction === direction ? 'active' : ''}
							onClick={() => handleDirectionChange(direction)}
						>
							{direction === 'expense' ? '支出' : direction === 'income' ? '収入' : '振替'}
						</button>
					))}
				</div>
			</div>
			<div className="form-grid">
				<label className="field">
					<span>日付</span>
					<input type="date" name="date" value={form.date} onChange={handleChange} required />
				</label>
				<label className="field">
					<span>金額</span>
					<input type="number" name="amount" value={form.amount} onChange={handleChange} min="0" required />
				</label>
				<label className="field">
					<span>内容</span>
					<input type="text" name="description" value={form.description} onChange={handleChange} placeholder="店名 / 摘要" required />
				</label>
				<label className="field">
					<span>メモ</span>
					<input type="text" name="memo" value={form.memo} onChange={handleChange} placeholder="任意" />
				</label>
				<label className="field">
					<span>支払方法</span>
					<select name="paymentMethod" value={form.paymentMethod} onChange={handleChange}>
						<option value="cash">現金</option>
						<option value="bank">銀行口座</option>
						<option value="credit">クレジットカード</option>
					</select>
				</label>
				<label className="field">
					<span>口座</span>
					<select name="accountId" value={form.accountId} onChange={handleChange} required>
						<option value="">選択してください</option>
						{accounts.map((account) => (
							<option key={account.id} value={account.id}>
								{account.name}
							</option>
						))}
					</select>
				</label>
				{form.direction === 'transfer' ? (
					<label className="field">
						<span>振替先口座</span>
						<select name="counterAccountId" value={form.counterAccountId} onChange={handleChange} required>
							<option value="">選択してください</option>
							{accounts
								.filter((account) => account.id !== form.accountId)
								.map((account) => (
									<option key={account.id} value={account.id}>
										{account.name}
									</option>
								))}
						</select>
					</label>
				) : (
					<label className="field">
						<span>カテゴリ</span>
						<select name="categoryId" value={form.categoryId} onChange={handleChange} required>
							<option value="">選択してください</option>
							{filteredCategories.map((category) => (
								<option key={category.id} value={category.id}>
									{category.name}
								</option>
							))}
						</select>
					</label>
				)}
			</div>
			{merchantSuggestions.length ? (
				<SuggestionGroup title="よく使うお店">
					{merchantSuggestions.map((merchant) => (
						<button key={merchant.description} type="button" className="chip" onClick={() => applyMerchant(merchant)}>
							{merchant.description}
						</button>
					))}
				</SuggestionGroup>
			) : null}
			{categorySuggestions.length ? (
				<SuggestionGroup title="よく使うカテゴリ">
					{categorySuggestions.map((category) => (
						<button key={category.id} type="button" className="chip" onClick={() => applyCategory(category.id)}>
							{category.name}
						</button>
					))}
				</SuggestionGroup>
			) : null}
			{accountSuggestions.length ? (
				<SuggestionGroup title="よく使う支払方法">
					{accountSuggestions.map((account) => (
						<button key={account.id} type="button" className="chip" onClick={() => applyAccount(account.id, account.type)}>
							{account.name}
						</button>
					))}
				</SuggestionGroup>
			) : null}
		</form>
	);
}

function SuggestionGroup({ title, children }) {
	return (
		<div className="suggestion-group">
			<p className="suggestion-label">{title}</p>
			<div className="chip-row">{children}</div>
		</div>
	);
}
