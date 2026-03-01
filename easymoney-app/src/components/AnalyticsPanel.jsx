import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, PieChart, Pie, Cell, Legend } from 'recharts';
import { formatCurrency } from '../lib/format.js';

const palette = ['#f87171', '#fb923c', '#fbbf24', '#60a5fa', '#a78bfa', '#34d399', '#f472b6', '#2dd4bf'];

export function AnalyticsPanel({ summary, monthly = [], categories = [], flows = [] }) {
	const expenseCategories = categories.filter((category) => category.kind === 'expense');

	return (
		<div className="analytics-grid">
			<div className="panel">
				<div className="panel-header">
					<div>
						<p className="panel-title">今月のサマリ</p>
						<p className="panel-subtitle">収入 / 支出 / 収支</p>
					</div>
				</div>
				<div className="summary-grid">
					<div>
						<p className="summary-label">収入</p>
						<p className="summary-value positive">{formatCurrency(summary?.month?.income ?? 0)}</p>
					</div>
					<div>
						<p className="summary-label">支出</p>
						<p className="summary-value negative">{formatCurrency(summary?.month?.expense ?? 0)}</p>
					</div>
					<div>
						<p className="summary-label">差額</p>
						<p className="summary-value">{formatCurrency(summary?.month?.net ?? 0)}</p>
					</div>
				</div>
			</div>

			<div className="panel chart-panel">
				<div className="panel-header">
					<div>
						<p className="panel-title">月次推移</p>
						<p className="panel-subtitle">過去 12 ヶ月</p>
					</div>
				</div>
				<div className="chart-wrapper">
					<ResponsiveContainer width="100%" height={300}>
						<LineChart data={monthly}>
							<XAxis dataKey="month" />
							<YAxis />
							<Tooltip formatter={(value) => formatCurrency(value)} />
							<Legend />
							<Line type="monotone" dataKey="income" stroke="#22c55e" name="収入" />
							<Line type="monotone" dataKey="expense" stroke="#ef4444" name="支出" />
							<Line type="monotone" dataKey="net" stroke="#6366f1" name="差額" />
						</LineChart>
					</ResponsiveContainer>
				</div>
			</div>

			<div className="panel chart-panel">
				<div className="panel-header">
					<div>
						<p className="panel-title">カテゴリ別支出</p>
						<p className="panel-subtitle">最新データから集計</p>
					</div>
				</div>
				<div className="chart-wrapper">
					<ResponsiveContainer width="100%" height={300}>
						<PieChart>
							<Pie data={expenseCategories} dataKey="total" nameKey="name" outerRadius={100}>
								{expenseCategories.map((entry, index) => (
									<Cell key={entry.id} fill={palette[index % palette.length]} />
								))}
							</Pie>
							<Tooltip formatter={(value, _name, props) => `${props.payload.name}: ${formatCurrency(value)}`} />
						</PieChart>
					</ResponsiveContainer>
					{!expenseCategories.length ? <p className="empty">まだ支出データがありません</p> : null}
				</div>
			</div>

			<div className="panel">
				<div className="panel-header">
					<div>
						<p className="panel-title">支払方法別トップフロー</p>
						<p className="panel-subtitle">どこで使っているかを確認</p>
					</div>
				</div>
				<div className="table-scroll">
					<table>
						<thead>
							<tr>
								<th>支払方法</th>
								<th>カテゴリ</th>
								<th className="align-right">金額</th>
							</tr>
						</thead>
						<tbody>
							{flows.map((flow) => (
								<tr key={`${flow.source}-${flow.target}`}>
									<td>{flow.source}</td>
									<td>{flow.target}</td>
									<td className="align-right">{formatCurrency(flow.value)}</td>
								</tr>
							))}
							{!flows.length ? (
								<tr>
									<td colSpan={3} className="empty">
										まだデータがありません
									</td>
								</tr>
							) : null}
						</tbody>
					</table>
				</div>
			</div>
		</div>
	);
}
