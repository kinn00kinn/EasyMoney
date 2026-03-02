import { useMemo, useState } from 'react';
import {
	ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { FlowBreakdown } from './FlowBreakdown.jsx';
import { formatCurrency } from '../lib/format.js';

const palette = ['#4F46E5', '#7C3AED', '#EC4899', '#F97316', '#EAB308', '#22C55E', '#14B8A6', '#6366F1'];

export function AnalyticsPanel({
	summary,
	monthly = [],
	categories = [],
	flows = { flows: [], paymentMethods: [] },
	selectedMonth,
	onSelectMonth,
	availableMonths = [],
}) {
	const [categoryKind, setCategoryKind] = useState('expense');
	const monthChips = useMemo(() => {
		const months = [...availableMonths].reverse();
		const latest = months.slice(-6).reverse();
		return ['all', ...latest];
	}, [availableMonths]);
	const filteredCategories = useMemo(
		() => categories.filter((category) => category.kind === categoryKind),
		[categories, categoryKind],
	);
	const periodLabel = selectedMonth === 'all' ? '全期間' : selectedMonth || summary?.period || '今月';

	return (
		<div className="analytics-grid">
			<div className="panel">
				<div className="panel-header">
					<p className="panel-title">分析期間</p>
				</div>
				<div className="analytics-month-chips">
					{monthChips.map((value) => (
						<button
							key={value}
							type="button"
							className="month-chip"
							data-active={(selectedMonth || '') === value || (!selectedMonth && value === 'all')}
							onClick={() => onSelectMonth?.(value === 'all' ? 'all' : value)}
						>
							{value === 'all' ? '全期間' : value}
						</button>
					))}
				</div>
			</div>

			<div className="panel">
				<div className="panel-header"><p className="panel-title">{periodLabel}のサマリ</p></div>
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
						<p className="panel-title">カテゴリ別 {categoryKind === 'expense' ? '支出' : '収入'}</p>
						<p className="panel-subtitle">{periodLabel}</p>
					</div>
					<div className="segmented-control compact">
						{['expense', 'income'].map((kind) => (
							<button
								key={kind}
								type="button"
								className={categoryKind === kind ? 'active' : ''}
								onClick={() => setCategoryKind(kind)}
							>
								{kind === 'expense' ? '支出' : '収入'}
							</button>
						))}
					</div>
				</div>
				<div className="chart-wrapper">
					{filteredCategories.length ? (
						<ResponsiveContainer width="100%" height={280}>
							<PieChart>
								<Pie data={filteredCategories} dataKey="total" nameKey="name" outerRadius={95} innerRadius={50} paddingAngle={1}>
									{filteredCategories.map((entry, index) => <Cell key={entry.id} fill={palette[index % palette.length]} />)}
								</Pie>
								<Tooltip
									formatter={(v, _n, point) => [`${formatCurrency(v)}`, point.payload.name]}
									contentStyle={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: '4px', fontSize: '0.8rem' }}
								/>
								<Legend wrapperStyle={{ fontSize: '0.72rem' }} />
							</PieChart>
						</ResponsiveContainer>
					) : (
						<p className="empty">データがありません</p>
					)}
				</div>
			</div>

			<div className="panel chart-panel">
				<div className="panel-header">
					<div>
						<p className="panel-title">支払方法別 入出金</p>
						<p className="panel-subtitle">{periodLabel}</p>
					</div>
				</div>
				<FlowBreakdown paymentMethods={flows.paymentMethods ?? []} flows={flows.flows ?? []} />
			</div>
		</div>
	);
}
