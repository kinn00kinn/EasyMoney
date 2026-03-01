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
				<div>
					<p className="panel-title">バックアップ</p>
					<p className="panel-subtitle">すべての口座・カテゴリ・取引・CSV 取込履歴を JSON で書き出します</p>
				</div>
				<div>
					<button className="btn primary" type="button" onClick={handleDownload} disabled={status.type === 'loading'}>
						{status.type === 'loading' ? '生成中…' : 'バックアップをダウンロード'}
					</button>
				</div>
			</div>
			<ul>
				<li>ファイル形式は JSON (UTF-8) です。Cloudflare D1 のデータをそのまま含みます。</li>
				<li>安全な場所に保管し、機密情報として扱ってください。</li>
				<li>今後のリストア機能追加時に読み込める構造になっています。</li>
			</ul>
			{status.type !== 'idle' ? <p className={`status ${status.type === 'error' ? 'error' : ''}`}>{status.message}</p> : null}
		</div>
	);
}

const extractFilename = (contentDisposition) => {
	if (!contentDisposition) {
		return `easymoney-backup-${new Date().toISOString().slice(0, 10)}.json`;
	}
	const match = /filename=\"?([^\";]+)\"?/i.exec(contentDisposition);
	return match?.[1] ?? `easymoney-backup-${new Date().toISOString().slice(0, 10)}.json`;
};

const triggerDownload = (blob, filename) => {
	const url = URL.createObjectURL(blob);
	const link = document.createElement('a');
	link.href = url;
	link.download = filename;
	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);
	URL.revokeObjectURL(url);
};
