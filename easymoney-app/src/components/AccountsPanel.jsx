import { formatCurrency } from '../lib/format.js';

const typeLabels = {
	cash: '現金',
	bank: '銀行',
	credit: 'クレジット',
};

export function AccountsPanel({ accounts = [] }) {
	return (
		<div className="panel">
			<div className="panel-header">
				<div>
					<p className="panel-title">口座残高</p>
					<p className="panel-subtitle">資産と負債のサマリ</p>
				</div>
			</div>
			<div className="account-grid">
				{accounts.map((account) => (
					<div key={account.id} className="account-card">
						<p className="account-name">{account.name}</p>
						<p className="account-type">{typeLabels[account.type]}</p>
						<p className="account-balance">{formatCurrency(account.balance)}</p>
					</div>
				))}
				{!accounts.length ? <p className="empty">口座を登録してください</p> : null}
			</div>
		</div>
	);
}
