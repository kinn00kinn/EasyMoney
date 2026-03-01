import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, Legend } from 'recharts';
import { SnakeGraph } from './SnakeGraph.jsx';
import { formatCurrency } from '../lib/format.js';

const palette = ['#0017C1', '#2563EB', '#F97316', '#E11D48', '#8B5CF6', '#22C55E', '#EC4899', '#14B8A6'];

export function AnalyticsPanel({ summary, monthly = [], categories = [], flows = [], selectedMonth }) {
	const expenseCategories = categories.filter((category) => category.kind === 'expense');

	return (
		<div className="analytics-grid">
			{/* Summary */}
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

			{/* Monthly Trends */}
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
							<CartesianGrid strokeDasharray="3 3" stroke="#EBEBEB" />
							<XAxis dataKey="month" tick={{ fontSize: 12, fill: '#626264' }} />
							<YAxis tick={{ fontSize: 12, fill: '#626264' }} />
							<Tooltip
								formatter={(value) => formatCurrency(value)}
								contentStyle={{
									background: '#fff',
									border: '1px solid #D9D9D9',
									borderRadius: '8px',
									fontSize: '0.85rem',
								}}
							/>
							<Legend wrapperStyle={{ fontSize: '0.8rem' }} />
							<Line type="monotone" dataKey="income" stroke="#118040" name="収入" strokeWidth={2} dot={false} />
							<Line type="monotone" dataKey="expense" stroke="#C53030" name="支出" strokeWidth={2} dot={false} />
							<Line type="monotone" dataKey="net" stroke="#0017C1" name="差額" strokeWidth={2} dot={false} />
						</LineChart>
					</ResponsiveContainer>
				</div>
			</div>

			{/* Category Breakdown */}
			<div className="panel chart-panel">
				<div className="panel-header">
					<div>
						<p className="panel-title">カテゴリ別支出</p>
						<p className="panel-subtitle">
							{selectedMonth ? `対象月: ${selectedMonth}` : '全期間を集計'}
						</p>
					</div>
				</div>
				<div className="chart-wrapper">
					<ResponsiveContainer width="100%" height={300}>
						<PieChart>
							<Pie
								data={expenseCategories}
								dataKey="total"
								nameKey="name"
								outerRadius={100}
								innerRadius={55}
								paddingAngle={2}
								cornerRadius={3}
							>
								{expenseCategories.map((entry, index) => (
									<Cell key={entry.id} fill={palette[index % palette.length]} />
								))}
							</Pie>
							<Tooltip
								formatter={(value, _name, props) => `${props.payload.name}: ${formatCurrency(value)}`}
								contentStyle={{
									background: '#fff',
									border: '1px solid #D9D9D9',
									borderRadius: '8px',
									fontSize: '0.85rem',
								}}
							/>
							<Legend wrapperStyle={{ fontSize: '0.8rem' }} />
						</PieChart>
					</ResponsiveContainer>
					{!expenseCategories.length ? <p className="empty">まだ支出データがありません</p> : null}
				</div>
			</div>

			{/* Snake (Sankey) Graph */}
			<div className="panel">
				<div className="panel-header">
					<div>
						<p className="panel-title">お金の流れ</p>
						<p className="panel-subtitle">支払方法 → カテゴリの全体像</p>
					</div>
				</div>
				<SnakeGraph flows={flows} />
			</div>
		</div>
	);
}
