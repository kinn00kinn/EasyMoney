import { useState } from 'react';
import { today } from '../lib/format.js';

const createInitialState = () => ({
	date: today(),
	amount: '',
	description: '',
	memo: '',
	accountId: '',
	categoryId: '',
	paymentMethod: 'cash',
});

export function TransactionForm({ accounts = [], categories = [], onSubmit, isSubmitting, suggestions = {} }) {
	const [form, setForm] = useState(() => createInitialState());
	const merchantSuggestions = suggestions.merchants ?? [];
	const categorySuggestions = suggestions.categories ?? [];
	const accountSuggestions = suggestions.accounts ?? [];

	const handleChange = (event) => {
		const { name, value } = event.target;
		setForm((prev) => ({ ...prev, [name]: value }));
		if (name === 'accountId') {
			const account = accounts.find((accountItem) => accountItem.id === value);
			if (account) {
				setForm((prev) => ({ ...prev, paymentMethod: account.type }));
			}
		}
	};

	const handleSubmit = (event) => {
		event.preventDefault();
		if (!form.accountId || !form.categoryId || !form.amount) return;
		onSubmit(form, () => setForm(createInitialState()));
	};

	const applyMerchant = (merchant) => {
		setForm((prev) => ({
			...prev,
			description: merchant.description,
			categoryId: merchant.categoryId ?? prev.categoryId,
			accountId: merchant.accountId ?? prev.accountId,
			paymentMethod: merchant.accountType ?? prev.paymentMethod,
		}));
	};

	const applyCategory = (categoryId) => {
		setForm((prev) => ({ ...prev, categoryId }));
	};

	const applyAccount = (accountId, accountType) => {
		setForm((prev) => ({ ...prev, accountId, paymentMethod: accountType ?? prev.paymentMethod }));
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
				<label className="field">
					<span>カテゴリ</span>
					<select name="categoryId" value={form.categoryId} onChange={handleChange} required>
						<option value="">選択してください</option>
						{categories.map((category) => (
							<option key={category.id} value={category.id}>
								{category.name}
							</option>
						))}
					</select>
				</label>
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
