import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.js';
import { formatCurrency, formatDate } from '../lib/format.js';

const defaultForm = {
	date: '',
	amount: '',
	description: '',
	memo: '',
	accountId: '',
	categoryId: '',
	counterAccountId: '',
	paymentMethod: 'cash',
};

export function TransactionDetail({ transactionId, accounts = [], categories = [], onClose, onUpdated }) {
	const queryClient = useQueryClient();
	const [form, setForm] = useState(defaultForm);

	const { data, isLoading, isFetching } = useQuery({
		queryKey: ['transaction', transactionId],
		queryFn: () => api.getTransaction(transactionId),
		enabled: Boolean(transactionId),
	});

	const transaction = data?.data;

	useEffect(() => {
		if (transaction) {
			setForm({
				date: transaction.date,
				amount: transaction.amount ?? 0,
				description: transaction.description,
				memo: transaction.memo ?? '',
				accountId: transaction.accountId,
				categoryId: transaction.categoryId ?? '',
				counterAccountId: transaction.counterAccountId ?? '',
				paymentMethod: transaction.paymentMethod,
			});
		}
	}, [transactionId, transaction]);

	const mutation = useMutation({
		mutationFn: (payload) => api.updateTransaction(transactionId, payload),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['transaction', transactionId] });
			onUpdated?.(transactionId);
		},
	});

	if (!transactionId) {
		return null;
	}

	const handleChange = (event) => {
		const { name, value } = event.target;
		setForm((prev) => ({ ...prev, [name]: value }));
		if (name === 'accountId') {
			const selectedAccount = accounts.find((account) => account.id === value);
			if (selectedAccount) {
				setForm((prev) => ({ ...prev, paymentMethod: selectedAccount.type }));
			}
		}
	};

	const handleSubmit = (event) => {
		event.preventDefault();
		if (!form) return;
		mutation.mutate({
			...form,
			amount: Number(form.amount),
			categoryId: form.categoryId || undefined,
			counterAccountId: form.counterAccountId || undefined,
		});
	};

	return (
		<div className="panel transaction-detail">
			<div className="panel-header">
				<div>
					<p className="panel-title">取引詳細</p>
					<p className="panel-subtitle">{transaction ? formatDate(transaction.date) : ''}</p>
				</div>
				<div className="detail-actions">
					<button className="btn" type="button" onClick={onClose}>
						閉じる
					</button>
				</div>
			</div>

			{isLoading || isFetching ? (
				<p className="status">読み込み中...</p>
			) : transaction ? (
				<>
					<div className="detail-summary">
						<div>
							<p className="summary-label">金額</p>
							<p className="summary-value">{formatCurrency(transaction.amount)}</p>
						</div>
						<div>
							<p className="summary-label">口座</p>
							<p className="summary-value">{transaction.accountName}</p>
						</div>
						<div>
							<p className="summary-label">カテゴリ</p>
							<p className="summary-value">{transaction.categoryName || '-'}</p>
						</div>
					</div>

					<div className="detail-section">
						<p className="detail-section-title">仕訳行</p>
						<div className="table-scroll">
							<table>
								<thead>
									<tr>
										<th>区分</th>
										<th>科目</th>
										<th className="align-right">金額</th>
									</tr>
								</thead>
								<tbody>
									{transaction.entries?.map((entry) => (
										<tr key={entry.id}>
											<td>{entry.side === 'debit' ? '借方' : '貸方'}</td>
											<td>
												<div className="table-primary">{entry.ledgerName}</div>
												<div className="table-secondary">{entry.ledgerType === 'account' ? '口座' : 'カテゴリ'}</div>
											</td>
											<td className="align-right">{formatCurrency(entry.amount)}</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					</div>

					<form className="detail-form" onSubmit={handleSubmit}>
						<p className="detail-section-title">内容を編集</p>
						<div className="form-grid">
							<label className="field">
								<span>日付</span>
								<input type="date" name="date" value={form.date} onChange={handleChange} required />
							</label>
							<label className="field">
								<span>金額</span>
								<input type="number" name="amount" value={form.amount} onChange={handleChange} required min="0" />
							</label>
							<label className="field">
								<span>内容</span>
								<input type="text" name="description" value={form.description} onChange={handleChange} required />
							</label>
							<label className="field">
								<span>メモ</span>
								<input type="text" name="memo" value={form.memo} onChange={handleChange} />
							</label>
							<label className="field">
								<span>支払方法</span>
								<select name="paymentMethod" value={form.paymentMethod} onChange={handleChange}>
									<option value="cash">現金</option>
									<option value="bank">銀行</option>
									<option value="credit">クレジット</option>
								</select>
							</label>
							<label className="field">
								<span>口座</span>
								<select name="accountId" value={form.accountId} onChange={handleChange} required>
									{accounts.map((account) => (
										<option key={account.id} value={account.id}>
											{account.name}
										</option>
									))}
								</select>
							</label>
							<label className="field">
								<span>カテゴリ</span>
								<select name="categoryId" value={form.categoryId} onChange={handleChange}>
									<option value="">選択してください</option>
									{categories.map((category) => (
										<option key={category.id} value={category.id}>
											{category.name}
										</option>
									))}
								</select>
							</label>
							<label className="field">
								<span>振替先口座</span>
								<select name="counterAccountId" value={form.counterAccountId} onChange={handleChange}>
									<option value="">選択</option>
									{accounts
										.filter((account) => account.id !== form.accountId)
										.map((account) => (
											<option key={account.id} value={account.id}>
												{account.name}
											</option>
										))}
								</select>
							</label>
						</div>
						<div className="detail-actions">
							<button className="btn primary" type="submit" disabled={mutation.isPending}>
								{mutation.isPending ? '更新中…' : '更新する'}
							</button>
						</div>
						{mutation.isError ? <p className="status">{mutation.error?.message}</p> : null}
						{mutation.isSuccess ? <p className="status">更新しました</p> : null}
					</form>
				</>
			) : (
				<p className="empty">取引が見つかりませんでした</p>
			)}
		</div>
	);
}
