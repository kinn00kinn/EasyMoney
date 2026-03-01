import { useState } from 'react';
import { api } from '../lib/api.js';

const defaultStatus = { type: 'idle', message: '' };

export function BackupPanel() {
	const [status, setStatus] = useState(defaultStatus);

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
