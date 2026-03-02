import { ResponsiveContainer, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, Bar } from 'recharts';
import { formatCurrency } from '../lib/format.js';

export function FlowBreakdown({ paymentMethods = [], flows = [] }) {
	const chartData = paymentMethods
		.map((method) => ({
			name: method.name,
			type: method.type,
			income: method.income ?? 0,
			expense: method.expense ?? 0,
		}))
		.filter((row) => row.income > 0 || row.expense > 0);

	const topFlows = flows.slice(0, 6);

	if (!chartData.length && !topFlows.length) {
		return <p className="empty">まだ入出金データがありません</p>;
	}

	return (
		<div className="flow-breakdown">
			{chartData.length ? (
				<div className="flow-chart">
					<ResponsiveContainer width="100%" height={300}>
						<BarChart data={chartData} layout="vertical" margin={{ left: 0, right: 16, top: 8 }}>
							<CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
							<XAxis
								type="number"
								tickFormatter={(value) => `${(value / 10000).toFixed(1)}万`}
								stroke="var(--color-text-tertiary)"
								fontSize={11}
							/>
							<YAxis dataKey="name" type="category" width={90} tick={{ fill: 'var(--color-text-tertiary)', fontSize: 11 }} />
							<Tooltip formatter={(value) => formatCurrency(value)} />
							<Legend wrapperStyle={{ fontSize: '0.75rem' }} />
							<Bar dataKey="income" name="収入" fill="#22C55E" radius={[0, 6, 6, 0]} />
							<Bar dataKey="expense" name="支出" fill="#EF4444" radius={[0, 6, 6, 0]} />
						</BarChart>
					</ResponsiveContainer>
				</div>
			) : (
				<p className="empty">グラフ化できる入出金データがありません</p>
			)}
			{topFlows.length ? (
				<div className="flow-list">
					<p className="flow-list-title">主要な支出フロー</p>
					<ul>
						{topFlows.map((flow) => (
							<li key={`${flow.source}-${flow.target}`}>
								<div>
									<p className="flow-list-source">{flow.source}</p>
									<p className="flow-list-arrow">↓</p>
									<p className="flow-list-target">{flow.target}</p>
								</div>
								<p className="flow-list-amount">{formatCurrency(flow.value)}</p>
							</li>
						))}
					</ul>
				</div>
			) : null}
		</div>
	);
}
