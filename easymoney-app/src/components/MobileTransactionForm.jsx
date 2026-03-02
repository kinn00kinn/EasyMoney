import { useState, useRef, useEffect, useMemo } from 'react';
import { today } from '../lib/format.js';

const createInitialState = () => ({
    date: today(),
    amount: '',
    description: '',
    memo: '',
    accountId: '',
    categoryId: '',
    paymentMethod: 'cash',
    direction: 'expense',
    counterAccountId: '',
});

/**
 * Finance-app inspired mobile transaction form (Zaim / MoneyForward style)
 *
 * Layout:
 *   ┌──────────────────────────────┐
 *   │  [支出 / 収入]   今日 ▼      │  ← type toggle + date chip
 *   │                              │
 *   │       ¥ 1,500               │  ← large amount display
 *   │  ─────────────────────       │
 *   │                              │
 *   │  ┌──────┐  ┌──────┐ ...     │  ← category chips (2–3 col grid)
 *   │  └──────┘  └──────┘         │
 *   │                              │
 *   │  ○ 現金  ○ PayPay銀行  ...  │  ← account pills
 *   │                              │
 *   │  [店名 / 摘要] [メモ]        │  ← optional text, collapsed
 *   │                              │
 *   │  ┌──────────────────────┐   │
 *   │  │      保存する         │   │  ← full-width CTA
 *   │  └──────────────────────┘   │
 *   └──────────────────────────────┘
 */
export function MobileTransactionForm({ accounts = [], categories = [], onSubmit, isSubmitting, suggestions = {} }) {
    const [form, setForm] = useState(() => createInitialState());
    const [showDetail, setShowDetail] = useState(false);
    const amountRef = useRef(null);

    const merchantSuggestions = suggestions.merchants ?? [];
    const categorySuggestions = suggestions.categories ?? [];
    const accountSuggestions = suggestions.accounts ?? [];
    const categoryMap = useMemo(() => new Map(categories.map((category) => [category.id, category.kind])), [categories]);
    // auto-focus amount on mount
    useEffect(() => {
        const timer = setTimeout(() => amountRef.current?.focus(), 300);
        return () => clearTimeout(timer);
    }, []);

    const set = (key, value) => setForm((p) => ({ ...p, [key]: value }));
    const resetForm = () => {
        setForm(createInitialState());
        setShowDetail(false);
    };

    const handleDirectionChange = (direction) => {
        setForm((prev) => {
            if (direction === 'transfer') {
                return { ...prev, direction, categoryId: '', counterAccountId: '' };
            }
            const targetKind = direction === 'income' ? 'income' : 'expense';
            const defaultCategoryId = categories.find((category) => category.kind === targetKind)?.id ?? '';
            return {
                ...prev,
                direction,
                categoryId: defaultCategoryId,
                counterAccountId: '',
            };
        });
    };

    const handleSubmit = () => {
        if (!form.accountId || !form.amount || !form.description) return;
        if (form.direction === 'transfer') {
            if (!form.counterAccountId) return;
        } else if (!form.categoryId) {
            return;
        }
        const payload = {
            ...form,
            categoryId: form.direction === 'transfer' ? null : form.categoryId,
            counterAccountId: form.direction === 'transfer' ? form.counterAccountId : null,
        };
        onSubmit(payload, resetForm);
    };

    const applyMerchant = (m) => {
        const categoryKind = m.categoryId ? categoryMap.get(m.categoryId) : null;
        const inferredDirection =
            categoryKind === 'income' ? 'income' : categoryKind === 'expense' ? 'expense' : form.direction;
        setForm((prev) => {
            const nextDirection = inferredDirection ?? prev.direction;
            const isTransfer = nextDirection === 'transfer';
            const directionKind = nextDirection === 'income' ? 'income' : 'expense';
            const merchantCategoryValid =
                !isTransfer && m.categoryId && categoryMap.get(m.categoryId) === directionKind;
            const account = m.accountId ? accounts.find((acc) => acc.id === m.accountId) : null;
            return {
                ...prev,
                description: m.description,
                direction: nextDirection,
                categoryId: merchantCategoryValid ? m.categoryId : isTransfer ? '' : prev.categoryId,
                counterAccountId: isTransfer ? '' : prev.counterAccountId,
                accountId: m.accountId ?? prev.accountId,
                paymentMethod: account?.type ?? m.accountType ?? prev.paymentMethod,
            };
        });
    };

    const pickAccount = (accountId, accountType) => {
        setForm((prev) => ({
            ...prev,
            accountId,
            paymentMethod: accountType ?? prev.paymentMethod,
            counterAccountId: prev.counterAccountId === accountId ? '' : prev.counterAccountId,
        }));
    };

    const pickCounterAccount = (accountId) => {
        if (accountId === form.accountId) return;
        setForm((prev) => ({
            ...prev,
            counterAccountId: prev.counterAccountId === accountId ? '' : accountId,
        }));
    };

    const formattedAmount = form.amount
        ? Number(form.amount).toLocaleString('ja-JP')
        : '';

    const hasRequiredCategory = form.direction === 'transfer' ? true : Boolean(form.categoryId);
    const hasCounter = form.direction === 'transfer' ? Boolean(form.counterAccountId) : true;
    const canSubmit = Boolean(form.accountId && form.amount && form.description && hasRequiredCategory && hasCounter);

    // Split categories into suggested (first) and others
    const suggestedCatIds = new Set(categorySuggestions.map((c) => c.id));
    const sortedCategories = [
        ...categorySuggestions,
        ...categories.filter((c) => !suggestedCatIds.has(c.id)),
    ];

    // Split accounts into suggested and others
    const suggestedAccIds = new Set(accountSuggestions.map((a) => a.id));
    const sortedAccounts = [
        ...accountSuggestions,
        ...accounts.filter((a) => !suggestedAccIds.has(a.id)),
    ];

    return (
        <div className="mf">
            <div className="mf-mode-toggle">
                {['expense', 'income', 'transfer'].map((mode) => (
                    <button
                        key={mode}
                        type="button"
                        className={form.direction === mode ? 'active' : ''}
                        onClick={() => handleDirectionChange(mode)}
                    >
                        {mode === 'expense' ? '支出' : mode === 'income' ? '収入' : '振替'}
                    </button>
                ))}
            </div>
            {/* ── Row 1: Date chip ── */}
            <div className="mf-topbar">
                <input
                    className="mf-date-chip"
                    type="date"
                    value={form.date}
                    onChange={(e) => set('date', e.target.value)}
                />
            </div>

            {/* ── Amount hero ── */}
            <div className="mf-amount-hero">
                <span className="mf-yen">¥</span>
                <input
                    ref={amountRef}
                    className="mf-amount-input"
                    type="number"
                    inputMode="decimal"
                    placeholder="0"
                    value={form.amount}
                    onChange={(e) => set('amount', e.target.value)}
                    min="0"
                />
            </div>
            {formattedAmount && (
                <p className="mf-amount-formatted">¥{formattedAmount}</p>
            )}

            {/* ── Quick suggestions ── */}
            {merchantSuggestions.length > 0 && (
                <div className="mf-section">
                    <p className="mf-label">よく使う</p>
                    <div className="mf-quick-row">
                        {merchantSuggestions.map((m) => (
                            <button
                                key={m.description}
                                type="button"
                                className="mf-quick-chip"
                                onClick={() => applyMerchant(m)}
                            >
                                {m.description}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* ── Description ── */}
            <div className="mf-section">
                <input
                    className="mf-input"
                    type="text"
                    placeholder="店名 / 摘要"
                    value={form.description}
                    onChange={(e) => set('description', e.target.value)}
                />
            </div>

            {/* ── Category grid ── */}
            {form.direction !== 'transfer' && (
                <div className="mf-section">
                    <p className="mf-label">カテゴリ</p>
                    <div className="mf-cat-grid">
                        {sortedCategories
                            .filter((c) => c.kind === (form.direction === 'income' ? 'income' : 'expense'))
                            .map((c) => (
                                <button
                                    key={c.id}
                                    type="button"
                                    className={`mf-cat-chip ${form.categoryId === c.id ? 'active' : ''}`}
                                    onClick={() => set('categoryId', c.id)}
                                >
                                    {c.name}
                                </button>
                            ))}
                    </div>
                </div>
            )}

            {/* ── Account pills ── */}
            <div className="mf-section">
                <p className="mf-label">支払方法</p>
                <div className="mf-acc-row">
                    {sortedAccounts.map((a) => (
                        <button
                            key={a.id}
                            type="button"
                            className={`mf-acc-pill ${form.accountId === a.id ? 'active' : ''}`}
                            onClick={() => pickAccount(a.id, a.type)}
                        >
                            {a.name}
                        </button>
                    ))}
                </div>
            </div>

            {form.direction === 'transfer' && (
                <div className="mf-section">
                    <p className="mf-label">振替先</p>
                    <div className="mf-acc-row">
                        {accounts
                            .filter((a) => a.id !== form.accountId)
                            .map((a) => (
                                <button
                                    key={a.id}
                                    type="button"
                                    className={`mf-acc-pill ${form.counterAccountId === a.id ? 'active' : ''}`}
                                    onClick={() => pickCounterAccount(a.id)}
                                >
                                    {a.name}
                                </button>
                            ))}
                    </div>
                </div>
            )}

            {/* ── Memo toggle ── */}
            {!showDetail ? (
                <button
                    type="button"
                    className="mf-detail-toggle"
                    onClick={() => setShowDetail(true)}
                >
                    + メモを追加
                </button>
            ) : (
                <div className="mf-section">
                    <input
                        className="mf-input"
                        type="text"
                        placeholder="メモ (任意)"
                        value={form.memo}
                        onChange={(e) => set('memo', e.target.value)}
                        autoFocus
                    />
                </div>
            )}

            {/* ── Submit ── */}
            <button
                className="mf-submit"
                type="button"
                onClick={handleSubmit}
                disabled={!canSubmit || isSubmitting}
            >
                {isSubmitting ? '保存中…' : '保存する'}
            </button>
        </div>
    );
}
