import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, Legend } from 'recharts';
import { SnakeGraph } from './SnakeGraph.jsx';
import { formatCurrency } from '../lib/format.js';

const palette = ['#4F46E5', '#7C3AED', '#EC4899', '#F97316', '#EAB308', '#22C55E', '#14B8A6', '#6366F1'];

export function AnalyticsPanel({ summary, monthly = [], categories = [], flows = [], selectedMonth }) {
	const expenseCategories = categories.filter((c) => c.kind === 'expense');

	return (
		<div className="analytics-grid">
			<div className="panel">
				<div className="panel-header"><p className="panel-title">今月のサマリ</p></div>
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
				<div className="panel-header"><p className="panel-title">月次推移</p></div>
				<div className="chart-wrapper">
					<ResponsiveContainer width="100%" height={280}>
						<LineChart data={monthly}>
							<CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
							<XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--color-text-tertiary)' }} />
							<YAxis tick={{ fontSize: 11, fill: 'var(--color-text-tertiary)' }} width={50} />
							<Tooltip
								formatter={(v) => formatCurrency(v)}
								contentStyle={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: '4px', fontSize: '0.8rem' }}
							/>
							<Legend wrapperStyle={{ fontSize: '0.75rem' }} />
							<Line type="monotone" dataKey="income" stroke="#16A34A" name="収入" strokeWidth={1.5} dot={false} />
							<Line type="monotone" dataKey="expense" stroke="#DC2626" name="支出" strokeWidth={1.5} dot={false} />
							<Line type="monotone" dataKey="net" stroke="#4F46E5" name="差額" strokeWidth={1.5} dot={false} />
						</LineChart>
					</ResponsiveContainer>
				</div>
			</div>

			<div className="panel chart-panel">
				<div className="panel-header">
					<div>
						<p className="panel-title">カテゴリ別支出</p>
						<p className="panel-subtitle">{selectedMonth || '全期間'}</p>
					</div>
				</div>
				<div className="chart-wrapper">
					<ResponsiveContainer width="100%" height={280}>
						<PieChart>
							<Pie data={expenseCategories} dataKey="total" nameKey="name" outerRadius={95} innerRadius={50} paddingAngle={1}>
								{expenseCategories.map((e, i) => <Cell key={e.id} fill={palette[i % palette.length]} />)}
							</Pie>
							<Tooltip
								formatter={(v, _n, p) => [`${formatCurrency(v)}`, p.payload.name]}
								contentStyle={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: '4px', fontSize: '0.8rem' }}
							/>
							<Legend wrapperStyle={{ fontSize: '0.72rem' }} />
						</PieChart>
					</ResponsiveContainer>
					{!expenseCategories.length && <p className="empty">まだ支出データがありません</p>}
				</div>
			</div>

			<div className="panel">
				<div className="panel-header">
					<div>
						<p className="panel-title">お金の流れ</p>
						<p className="panel-subtitle">支払方法 → カテゴリ</p>
					</div>
				</div>
				<SnakeGraph flows={flows} />
			</div>
		</div>
	);
}
