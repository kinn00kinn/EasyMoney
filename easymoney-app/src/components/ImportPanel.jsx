import { useState } from 'react';
import { api } from '../lib/api.js';
import { formatCurrency } from '../lib/format.js';

export function ImportPanel({ accounts = [], categories = [], onImported }) {
	const [accountId, setAccountId] = useState('');
	const [file, setFile] = useState(null);
	const [preview, setPreview] = useState(null);
	const [mapping, setMapping] = useState({});
	const [status, setStatus] = useState({ uploading: false, confirming: false, message: '' });

	const handleUpload = async (e) => {
		e.preventDefault();
		if (!accountId || !file) return;
		setStatus({ uploading: true, confirming: false, message: '' });
		const formData = new FormData();
		formData.append('accountId', accountId);
		formData.append('file', file);
		try {
			const response = await api.uploadPayPay(formData);
			setPreview(response.data);
			setMapping({});
			setStatus({ uploading: false, confirming: false, message: '解析完了' });
		} catch (error) {
			setStatus({ uploading: false, confirming: false, message: error.message });
		}
	};

	const handleConfirm = async () => {
		if (!preview) return;
		const rows = preview.rows.map((r) => {
			const categoryId = mapping[r.id];
			return categoryId ? { rowId: r.id, categoryId } : null;
		}).filter(Boolean);
		if (!rows.length) { setStatus({ uploading: false, confirming: false, message: 'カテゴリを選択してください' }); return; }
		setStatus({ uploading: false, confirming: true, message: '' });
		try {
			await api.confirmImport(preview.importId, rows);
			setPreview(null); setMapping({});
			setStatus({ uploading: false, confirming: false, message: '取り込みました' });
			onImported?.();
		} catch (error) {
			setStatus({ uploading: false, confirming: false, message: error.message });
		}
	};

	return (
		<div className="panel">
			<div className="panel-header"><p className="panel-title">PayPay銀行 CSV 取込</p></div>
			<form className="import-form" onSubmit={handleUpload}>
				<label className="field">
					<span>口座</span>
					<select value={accountId} onChange={(e) => setAccountId(e.target.value)} required>
						<option value="">選択</option>
						{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
					</select>
				</label>
				<label className="field">
					<span>CSV</span>
					<input type="file" accept=".csv,text/csv" onChange={(e) => setFile(e.target.files?.[0] ?? null)} required />
				</label>
				<div>
					<button className="btn" type="submit" disabled={status.uploading}>
						{status.uploading ? '解析中…' : '読み込む'}
					</button>
				</div>
			</form>
			{status.message && <p className="status">{status.message}</p>}
			{preview && (
				<div className="import-preview">
					<p className="preview-title">{preview.rows.length}件</p>
					<div className="table-scroll">
						<table>
							<thead><tr><th>日付</th><th>内容</th><th>区分</th><th>金額</th><th>カテゴリ</th></tr></thead>
							<tbody>
								{preview.rows.map((r) => (
									<tr key={r.id}>
										<td>{r.date}</td><td>{r.description}</td>
										<td>{r.flow === 'inflow' ? '入金' : '出金'}</td>
										<td className="align-right">{formatCurrency(r.amount)}</td>
										<td>
											<select value={mapping[r.id] ?? ''} onChange={(e) => setMapping((p) => ({ ...p, [r.id]: e.target.value || undefined }))}>
												<option value="">選択</option>
												{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
											</select>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
					<div className="import-actions">
						<button className="btn primary" type="button" onClick={handleConfirm} disabled={status.confirming}>
							{status.confirming ? '登録中…' : '登録する'}
						</button>
						<button className="btn" type="button" onClick={() => { setPreview(null); setMapping({}); }}>クリア</button>
					</div>
				</div>
			)}
		</div>
	);
}
