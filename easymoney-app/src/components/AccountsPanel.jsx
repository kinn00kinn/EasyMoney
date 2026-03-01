import { Banknote, Building2, CreditCard } from 'lucide-react';
import { formatCurrency } from '../lib/format.js';

const typeLabels = { cash: '現金', bank: '銀行', credit: 'クレジット' };
const typeIcons = { cash: Banknote, bank: Building2, credit: CreditCard };

export function AccountsPanel({ accounts = [], onEdit, onDelete, editingAccountId, disableActions }) {
	return (
		<div className="panel">
			<div className="panel-header">
				<p className="panel-title">口座残高</p>
			</div>
			<div className="account-grid">
				{accounts.map((account) => {
					const Icon = typeIcons[account.type] ?? Banknote;
					return (
						<div key={account.id} className="account-card" data-editing={account.id === editingAccountId}>
							<p className="account-name">
								<Icon size={14} className="account-type-icon" />
								{account.name}
							</p>
							<p className="account-type">{typeLabels[account.type]}</p>
							<p className="account-balance" style={{ color: account.balance >= 0 ? 'var(--color-positive)' : 'var(--color-negative)' }}>
								{formatCurrency(account.balance)}
							</p>
							<div className="account-card-actions">
								<button className="btn" type="button" onClick={() => onEdit?.(account)} disabled={disableActions}>編集</button>
								<button className="btn danger" type="button" onClick={() => onDelete?.(account)} disabled={disableActions}>削除</button>
							</div>
						</div>
					);
				})}
				{!accounts.length && <p className="empty">口座を登録してください</p>}
			</div>
		</div>
	);
}
