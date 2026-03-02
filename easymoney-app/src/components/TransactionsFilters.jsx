import { useMemo } from 'react';

export function TransactionsFilters({
	accounts = [],
	filters,
	onChange,
	onReset,
}) {
	const accountOptions = useMemo(
		() =>
			accounts.map((account) => ({
				id: account.id,
				name: account.name,
				type: account.type,
			})),
		[accounts],
	);

	const handleInput = (event) => {
		const { name, value } = event.target;
		onChange?.({ [name]: value });
	};

	const handleDirectionChange = (direction) => {
		onChange?.({ direction });
	};

	return (
		<div className="transactions-filters">
			<div className="filters-row">
				<label className="field">
					<span>キーワード</span>
					<input
						type="search"
						name="search"
						value={filters.search}
						onChange={handleInput}
						placeholder="内容 / メモ / カテゴリ"
					/>
				</label>
				<label className="field">
					<span>口座</span>
					<select name="accountId" value={filters.accountId} onChange={handleInput}>
						<option value="">すべて</option>
						{accountOptions.map((account) => (
							<option key={account.id} value={account.id}>
								{account.name}
							</option>
						))}
					</select>
				</label>
			</div>
			<div className="filters-row">
				<div className="field">
					<span>区分</span>
					<div className="segmented-control compact">
						{[
							{ id: 'all', label: 'すべて' },
							{ id: 'expense', label: '支出' },
							{ id: 'income', label: '収入' },
							{ id: 'transfer', label: '振替' },
						].map((option) => (
							<button
								key={option.id}
								type="button"
								className={filters.direction === option.id ? 'active' : ''}
								onClick={() => handleDirectionChange(option.id)}
							>
								{option.label}
							</button>
						))}
					</div>
				</div>
				<div className="filters-actions">
					<button className="btn" type="button" onClick={onReset}>
						条件をクリア
					</button>
				</div>
			</div>
		</div>
	);
}
