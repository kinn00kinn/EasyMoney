import { useEffect, useRef } from 'react';
import { formatCurrency, formatDate } from '../lib/format.js';

export function TransactionsTable({
	transactions = [],
	selectedId,
	onSelect,
	editMode = false,
	selection = [],
	onToggleSelection,
	onToggleSelectAll,
}) {
	const handleSelect = (id) => {
		if (!onSelect) return;
		onSelect(id === selectedId ? null : id);
	};
	const selectionSet = new Set(selection);
	const allSelected = editMode && transactions.length > 0 && selection.length === transactions.length;
	const indeterminate = editMode && selection.length > 0 && selection.length < transactions.length;
	const headerCheckboxRef = useRef(null);

	useEffect(() => {
		if (headerCheckboxRef.current) {
			headerCheckboxRef.current.indeterminate = indeterminate;
		}
	}, [indeterminate]);

	const handleRowAction = (id) => {
		if (editMode) {
			onToggleSelection?.(id);
		} else {
			handleSelect(id);
		}
	};

	return (
		<div className="panel">
			<div className="panel-header">
				<p className="panel-title">最近の取引</p>
				<p className="panel-subtitle">{transactions.length}件</p>
			</div>

			{/* Desktop: table view */}
			<div className="table-scroll desktop-only">
				<table>
					<thead>
						<tr>
							{editMode && (
								<th className="checkbox-cell">
									<input
										type="checkbox"
										ref={headerCheckboxRef}
										checked={allSelected}
										onChange={(event) => onToggleSelectAll?.(event.target.checked)}
									/>
								</th>
							)}
							<th>日付</th>
							<th>内容</th>
							<th>カテゴリ</th>
							<th>口座</th>
							<th className="align-right">金額</th>
						</tr>
					</thead>
					<tbody>
						{transactions.map((tx) => (
							<tr
								key={tx.id}
								onClick={() => handleRowAction(tx.id)}
								className="table-row"
								data-selected={tx.id === selectedId}
								data-edit-mode={editMode}
							>
								{editMode && (
									<td className="checkbox-cell">
										<input
											type="checkbox"
											checked={selectionSet.has(tx.id)}
											onChange={(event) => {
												event.stopPropagation();
												onToggleSelection?.(tx.id);
											}}
										/>
									</td>
								)}
								<td>{formatDate(tx.date)}</td>
								<td>
									<div className="table-primary">{tx.description}</div>
									{tx.memo && <div className="table-secondary">{tx.memo}</div>}
								</td>
								<td>{tx.categoryName || '-'}</td>
								<td>{tx.accountName}</td>
								<td className="align-right amount" data-direction={tx.direction}>{formatCurrency(tx.amount)}</td>
							</tr>
						))}
						{!transactions.length && (
							<tr><td colSpan={editMode ? 6 : 5} className="empty">まだ取引がありません</td></tr>
						)}
					</tbody>
				</table>
			</div>

			{/* Mobile: card list view */}
			<div className="mobile-only">
				{transactions.length ? (
					<div className="mobile-tx-list">
						{transactions.map((tx) => (
							<div
								key={tx.id}
								className="mobile-tx-item"
								onClick={() => handleRowAction(tx.id)}
								data-selected={tx.id === selectedId}
								data-edit-mode={editMode}
							>
								{editMode && (
									<input
										type="checkbox"
										className="mobile-tx-checkbox"
										checked={selectionSet.has(tx.id)}
										onChange={(event) => {
											event.stopPropagation();
											onToggleSelection?.(tx.id);
										}}
									/>
								)}
								<div className="mobile-tx-left">
									<div className="mobile-tx-desc">{tx.description}</div>
									<div className="mobile-tx-meta">
										{tx.categoryName || '-'} · {tx.accountName}
									</div>
								</div>
								<div className="mobile-tx-right">
									<div className="mobile-tx-amount" data-direction={tx.direction}>
										{formatCurrency(tx.amount)}
									</div>
									<div className="mobile-tx-date">{formatDate(tx.date)}</div>
								</div>
							</div>
						))}
					</div>
				) : (
					<p className="empty">まだ取引がありません</p>
				)}
			</div>
		</div>
	);
}
