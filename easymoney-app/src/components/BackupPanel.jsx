import { useState } from 'react';
import { api } from '../lib/api.js';

const defaultStatus = { type: 'idle', message: '' };

export function BackupPanel() {
	const [status, setStatus] = useState(defaultStatus);
	const [file, setFile] = useState(null);

	const handleDownload = async () => {
		setStatus({ type: 'loading', message: 'バックアップを準備しています…' });
		try {
			const response = await api.downloadBackup();
			const blob = await response.blob();
			const filename = extractFilename(response.headers.get('content-disposition'));
			triggerDownload(blob, filename);
			setStatus({ type: 'success', message: `${filename} を保存しました` });
		} catch (error) {
			setStatus({ type: 'error', message: error.message || 'バックアップに失敗しました' });
		}
	};

	const handleRestore = async () => {
		if (!file) {
			setStatus({ type: 'error', message: '復元するバックアップファイルを選択してください' });
			return;
		}
		setStatus({ type: 'loading', message: 'バックアップを復元しています…' });
		try {
			const text = await file.text();
			const payload = JSON.parse(text);
			await api.restoreBackup(payload);
			setStatus({ type: 'success', message: 'バックアップを復元しました' });
			setFile(null);
		} catch (error) {
			setStatus({ type: 'error', message: error.message || '復元に失敗しました' });
		}
	};

	return (
		<div className="panel">
			<div className="panel-header">
				<p className="panel-title">バックアップ</p>
				<button className="btn primary" type="button" onClick={handleDownload} disabled={status.type === 'loading'}>
					{status.type === 'loading' ? '生成中…' : 'ダウンロード'}
				</button>
			</div>
			<div className="backup-notes">
				<ul>
					<li>JSON (UTF-8) 形式で口座・カテゴリ・取引を含みます</li>
					<li>安全な場所に保管してください</li>
				</ul>
			</div>
			<div className="backup-upload">
				<label className="field">
					<span>バックアップ JSON</span>
					<input type="file" accept="application/json,.json" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
				</label>
				<button className="btn" type="button" onClick={handleRestore} disabled={status.type === 'loading'}>
					{status.type === 'loading' ? '処理中…' : 'アップロードで復元'}
				</button>
			</div>
			{status.type !== 'idle' && <p className={`status ${status.type === 'error' ? 'error' : ''}`}>{status.message}</p>}
		</div>
	);
}

const extractFilename = (cd) => {
	if (!cd) return `easymoney-backup-${new Date().toISOString().slice(0, 10)}.json`;
	const m = /filename=\"?([^\";]+)\"?/i.exec(cd);
	return m?.[1] ?? `easymoney-backup-${new Date().toISOString().slice(0, 10)}.json`;
};

const triggerDownload = (blob, filename) => {
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	URL.revokeObjectURL(url);
};
