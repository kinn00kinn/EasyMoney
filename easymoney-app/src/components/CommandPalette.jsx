import { useEffect, useMemo, useRef, useState } from 'react';

export function CommandPalette({ open, onClose, actions = [] }) {
	const [query, setQuery] = useState('');
	const [highlighted, setHighlighted] = useState(0);
	const inputRef = useRef(null);

	useEffect(() => {
		if (open) {
			setQuery('');
			setHighlighted(0);
			const frame = requestAnimationFrame(() => inputRef.current?.focus());
			return () => cancelAnimationFrame(frame);
		}
		return undefined;
	}, [open]);

	const filtered = useMemo(() => {
		if (!query.trim()) return actions;
		const q = query.toLowerCase();
		return actions.filter(
			(action) =>
				action.label.toLowerCase().includes(q) ||
				action.description?.toLowerCase()?.includes(q),
		);
	}, [actions, query]);

	useEffect(() => {
		if (!open) return undefined;
		const handler = (event) => {
			if (event.key === 'Escape') {
				event.preventDefault();
				onClose?.();
			}
			if (!filtered.length) return;
			if (event.key === 'ArrowDown') {
				event.preventDefault();
				setHighlighted((prev) => (prev + 1) % filtered.length);
			}
			if (event.key === 'ArrowUp') {
				event.preventDefault();
				setHighlighted((prev) => (prev - 1 + filtered.length) % filtered.length);
			}
			if (event.key === 'Enter') {
				event.preventDefault();
				const action = filtered[highlighted];
				if (action) {
					action.run?.();
					onClose?.();
				}
			}
		};
		window.addEventListener('keydown', handler);
		return () => window.removeEventListener('keydown', handler);
	}, [open, filtered, highlighted, onClose]);

	const handleSelect = (action) => {
		action.run?.();
		onClose?.();
	};

	if (!open) return null;

	return (
		<div className="command-overlay" onClick={onClose}>
			<div className="command-panel" onClick={(e) => e.stopPropagation()}>
				<input
					ref={inputRef}
					type="search"
					placeholder="何をしますか？"
					value={query}
					onChange={(event) => setQuery(event.target.value)}
				/>
				<div className="command-list">
					{filtered.length ? (
						filtered.map((action, index) => (
							<button
								key={action.id}
								type="button"
								className={index === highlighted ? 'active' : ''}
								onClick={() => handleSelect(action)}
							>
								<div>
									<p className="command-label">{action.label}</p>
									{action.description && <p className="command-desc">{action.description}</p>}
								</div>
								{action.hint && <span className="command-hint">{action.hint}</span>}
							</button>
						))
					) : (
						<p className="empty">一致するアクションが見つかりません</p>
					)}
				</div>
			</div>
		</div>
	);
}
