import { formatCurrency, formatDate } from '../lib/format.js';

export function TransactionsTable({ transactions = [] }) {
	return (
		<div className="panel">
			<div className="panel-header">
				<div>
					<p className="panel-title">最近の取引</p>
					<p className="panel-subtitle">最新 50 件を表示しています</p>
				</div>
			</div>
			<div className="table-scroll">
				<table>
					<thead>
						<tr>
							<th>日付</th>
							<th>内容</th>
							<th>カテゴリ</th>
							<th>口座</th>
							<th className="align-right">金額</th>
						</tr>
					</thead>
					<tbody>
						{transactions.map((transaction) => (
							<tr key={transaction.id}>
								<td>{formatDate(transaction.date)}</td>
								<td>
									<div className="table-primary">{transaction.description}</div>
									{transaction.memo ? <div className="table-secondary">{transaction.memo}</div> : null}
								</td>
								<td>{transaction.categoryName || '-'}</td>
								<td>{transaction.accountName}</td>
								<td className="align-right amount" data-direction={transaction.direction}>
									{formatCurrency(transaction.amount)}
								</td>
							</tr>
						))}
						{!transactions.length ? (
							<tr>
								<td colSpan={5} className="empty">
									まだ取引がありません
								</td>
							</tr>
						) : null}
					</tbody>
				</table>
			</div>
		</div>
	);
}
