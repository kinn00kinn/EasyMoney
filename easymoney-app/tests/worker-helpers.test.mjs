import { describe, expect, it } from 'vitest';
import { __workerTest } from '../worker/index.js';

describe('worker helper functions', () => {
	const { buildEntries, normalizePayPayRow, amountFromCsv, authorizeDemoRequest } = __workerTest;

	it('creates balanced entries for expense, income, and transfer', () => {
		const expense = buildEntries({
			transactionId: 'txn',
			direction: 'expense',
			amountCents: 5000,
			accountId: 'acc-cash',
			categoryId: 'cat-food',
		});
		expect(expense).toHaveLength(2);
		expect(expense[0].side).toBe('debit');
		expect(expense[1].side).toBe('credit');

		const income = buildEntries({
			transactionId: 'txn',
			direction: 'income',
			amountCents: 10000,
			accountId: 'acc-bank',
			categoryId: 'cat-income',
		});
		expect(income).toHaveLength(2);
		expect(income[0].ledgerType).toBe('account');
		expect(income[1].ledgerType).toBe('category');

		const transfer = buildEntries({
			transactionId: 'txn',
			direction: 'transfer',
			amountCents: 2000,
			accountId: 'acc-cash',
			categoryId: null,
			counterAccountId: 'acc-bank',
		});
		expect(transfer).toHaveLength(2);
		expect(transfer[0].ledgerId).toBe('acc-bank');
		expect(transfer[1].ledgerId).toBe('acc-cash');
	});

	it('rejects invalid transfer requests', () => {
		expect(() =>
			buildEntries({
				transactionId: 'txn',
				direction: 'transfer',
				amountCents: 1000,
				accountId: 'acc-one',
				counterAccountId: 'acc-one',
			}),
		).toThrow(/Transfer requires different accounts/);
	});

	it('normalizes PayPay CSV rows', () => {
		const row = normalizePayPayRow({
			入出金日: '2026/03/01',
			出金額: '1,234',
			摘要: 'スーパー',
			メモ: '買い出し',
		});
		expect(row).not.toBeNull();
		expect(row.flow).toBe('outflow');
		expect(row.amountCents).toBe(123400);
		expect(row.description).toBe('スーパー');
	});

	it('handles split operation date columns and お支払/お預り金額', () => {
		const outflow = normalizePayPayRow({
			'操作日(年)': '2026',
			'操作日(月)': '2',
			'操作日(日)': '27',
			お支払金額: '7,644',
			摘要: 'ＰＡＹＰＡＹカ－ド',
		});
		expect(outflow).not.toBeNull();
		expect(outflow.date).toBe('2026-02-27');
		expect(outflow.flow).toBe('outflow');
		expect(outflow.amountCents).toBe(764400);

		const inflow = normalizePayPayRow({
			'操作日(年)': '2026',
			'操作日(月)': '1',
			'操作日(日)': '13',
			お預り金額: '50,000',
			摘要: 'ローソンATM入金',
		});
		expect(inflow.flow).toBe('inflow');
		expect(inflow.amountCents).toBe(5000000);
	});

	it('parses amount strings consistently', () => {
		expect(amountFromCsv('1,000')).toBe(100000);
		expect(amountFromCsv('  250.5 ')).toBe(25050);
		expect(amountFromCsv('')).toBe(0);
	});

	it('requires demo token for seeding', () => {
		const env = { DEMO_TOKEN: 'token-123' };
		const makeRequest = (header) =>
			new Request('http://localhost/api/demo/seed', {
				headers: header ? { authorization: header } : {},
			});

		expect(() => authorizeDemoRequest(makeRequest(), env)).toThrow();
		expect(() => authorizeDemoRequest(makeRequest('Bearer wrong'), env)).toThrow();
		expect(() => authorizeDemoRequest(makeRequest('Bearer token-123'), env)).not.toThrow();
	});
});
