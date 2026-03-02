import { useMemo, useState } from 'react';

export function TransactionsBulkEditor({
	count = 0,
	accounts = [],
	categories = [],
	onApply,
	onCancel,
	isApplying = false,
	errorMessage = '',
}) {
	const [direction, setDirection] = useState('expense');
	const [categoryId, setCategoryId] = useState('');
	const [counterAccountId, setCounterAccountId] = useState('');
	const [error, setError] = useState('');

	const handleDirectionChange = (nextDirection) => {
		setDirection(nextDirection);
		setError('');
		if (nextDirection === 'transfer') {
			setCategoryId('');
			setCounterAccountId('');
		} else {
			const targetKind = nextDirection === 'income' ? 'income' : 'expense';
			const defaultCategory = categories.find((category) => category.kind === targetKind);
			setCategoryId(defaultCategory?.id ?? '');
		}
	};

	const filteredCategories = useMemo(() => {
		if (direction === 'transfer') return [];
		const targetKind = direction === 'income' ? 'income' : 'expense';
		return categories.filter((category) => category.kind === targetKind);
	}, [categories, direction]);

	const handleApply = () => {
		if (!count) {
			setError('取引を選択してください');
			return;
		}
		if (direction === 'transfer') {
			if (!counterAccountId) {
				setError('振替先口座を選択してください');
				return;
			}
		} else if (!categoryId) {
			setError('カテゴリを選択してください');
			return;
		}
		setError('');
		onApply?.({
			direction,
			categoryId: direction === 'transfer' ? null : categoryId,
			counterAccountId: direction === 'transfer' ? counterAccountId : null,
		});
	};

	return (
		<div className="bulk-edit-bar">
			<div className="bulk-edit-body">
				<div className="bulk-edit-count">
					<p>{count}件選択中</p>
					<div className="segmented-control compact">
						{['expense', 'income', 'transfer'].map((mode) => (
							<button
								key={mode}
								type="button"
								className={direction === mode ? 'active' : ''}
								onClick={() => handleDirectionChange(mode)}
							>
								{mode === 'expense' ? '支出' : mode === 'income' ? '収入' : '振替'}
							</button>
						))}
					</div>
				</div>
				{direction === 'transfer' ? (
					<label className="field inline">
						<span>振替先</span>
						<select value={counterAccountId} onChange={(event) => setCounterAccountId(event.target.value)}>
							<option value="">選択してください</option>
							{accounts.map((account) => (
								<option key={account.id} value={account.id}>
									{account.name}
								</option>
							))}
						</select>
					</label>
				) : (
					<label className="field inline">
						<span>カテゴリ</span>
						<select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
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
			<div className="bulk-edit-actions">
				{(error || errorMessage) && <p className="status error">{error || errorMessage}</p>}
				<div className="button-row">
					<button className="btn" type="button" onClick={onCancel} disabled={isApplying}>
						キャンセル
					</button>
					<button className="btn primary" type="button" onClick={handleApply} disabled={isApplying}>
						{isApplying ? '適用中…' : '一括更新'}
					</button>
				</div>
			</div>
		</div>
	);
}
