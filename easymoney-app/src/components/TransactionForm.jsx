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

export function TransactionForm({ accounts = [], categories = [], onSubmit, isSubmitting }) {
	const [form, setForm] = useState(() => createInitialState());

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
		</form>
	);
}
