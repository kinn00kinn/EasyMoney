import { Router } from 'itty-router';
import { z } from 'zod';
import Papa from 'papaparse';

const router = Router({ base: '/api' });

const json = (data, init = {}) =>
	new Response(JSON.stringify(data), {
		headers: {
			'content-type': 'application/json; charset=utf-8',
			...init.headers,
		},
		status: init.status ?? 200,
	});

const parseJsonBody = async (request) => {
	const text = await request.text();
	if (!text) return {};
	try {
		return JSON.parse(text);
	} catch (error) {
		throw createHttpError(400, 'Invalid JSON body');
	}
};

const createHttpError = (status = 500, message = 'Unexpected error') => {
	const error = new Error(message);
	error.status = status;
	return error;
};

const amountToCents = (value) => {
	if (typeof value === 'number') {
		return Math.round(value * 100);
	}
	if (typeof value === 'string') {
		const normalized = value.replace(/,/g, '').trim();
		const parsed = Number(normalized);
		if (Number.isNaN(parsed)) {
			throw createHttpError(400, 'Amount must be a number');
		}
		return Math.round(parsed * 100);
	}
	throw createHttpError(400, 'Amount must be numeric');
};

const centsToAmount = (value) => Number((value ?? 0) / 100);

const ensureIsoDate = (value) => {
	if (!value) throw createHttpError(400, 'Date is required');
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) {
		throw createHttpError(400, 'Date is invalid');
	}
	return date.toISOString().slice(0, 10);
};

const baseAccount = z.object({
	name: z.string().min(1),
	type: z.enum(['cash', 'bank', 'credit']),
	note: z.string().optional(),
	sortOrder: z.number().optional(),
});

const baseCategory = z.object({
	name: z.string().min(1),
	kind: z.enum(['expense', 'income', 'transfer']),
	color: z.string().optional(),
});

const transactionInput = z.object({
	date: z.string().min(8),
	amount: z.union([z.string(), z.number()]),
	description: z.string().min(1),
	memo: z.string().optional(),
	accountId: z.string().min(1),
	categoryId: z.string().optional(),
	paymentMethod: z.enum(['cash', 'bank', 'credit']),
	counterAccountId: z.string().optional(),
	direction: z.enum(['expense', 'income', 'transfer']).optional(),
	source: z.string().optional(),
});

const transactionUpdateInput = transactionInput
	.partial()
	.refine((value) => Object.keys(value).length > 0, {
		message: 'At least one field is required',
	});

const confirmImportSchema = z.object({
	rows: z
		.array(
			z.object({
				rowId: z.string().min(1),
				categoryId: z.string().min(1),
			}),
		)
		.min(1),
});

router.get('/health', () => json({ ok: true }));

router.get('/accounts', async (_request, env) => {
	const result = await env.DB.prepare(
		`SELECT a.*, IFNULL(SUM(
        CASE WHEN e.side = 'debit' THEN e.amount ELSE -e.amount END
      ), 0) AS balance_cents
    FROM accounts a
    LEFT JOIN entries e ON e.ledger_type = 'account' AND e.ledger_id = a.id
    WHERE a.is_archived = 0
    GROUP BY a.id
    ORDER BY a.sort_order, a.created_at`,
	).all();

	return json({
		data: result.results.map((row) => ({
			id: row.id,
			name: row.name,
			type: row.type,
			currency: row.currency,
			note: row.note,
			balance: centsToAmount(row.balance_cents),
		})),
	});
});

router.post('/accounts', async (request, env) => {
	const payload = baseAccount.parse(await parseJsonBody(request));
	const id = crypto.randomUUID();
	const now = new Date().toISOString();

	await env.DB.prepare(
		`INSERT INTO accounts (id, name, type, note, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
	)
		.bind(id, payload.name, payload.type, payload.note ?? null, payload.sortOrder ?? 0, now, now)
		.run();

	return json(
		{
			data: {
				id,
				name: payload.name,
				type: payload.type,
				note: payload.note ?? null,
				balance: 0,
				currency: 'JPY',
			},
		},
		{ status: 201 },
	);
});

router.get('/categories', async (_request, env) => {
	const rows = await env.DB.prepare(
		`SELECT c.*, IFNULL(SUM(
        CASE WHEN e.side = 'debit' THEN e.amount ELSE -e.amount END
      ), 0) AS total_cents
     FROM categories c
     LEFT JOIN entries e ON e.ledger_type = 'category' AND e.ledger_id = c.id
     WHERE c.is_archived = 0
     GROUP BY c.id
     ORDER BY c.created_at`,
	).all();

	return json({
		data: rows.results.map((row) => ({
			id: row.id,
			name: row.name,
			kind: row.kind,
			color: row.color,
			total: centsToAmount(row.total_cents),
		})),
	});
});

router.post('/categories', async (request, env) => {
	const payload = baseCategory.parse(await parseJsonBody(request));
	const id = crypto.randomUUID();
	const now = new Date().toISOString();

	await env.DB.prepare(
		`INSERT INTO categories (id, name, kind, color, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
	)
		.bind(id, payload.name, payload.kind, payload.color ?? null, now, now)
		.run();

	return json(
		{
			data: {
				id,
				...payload,
				total: 0,
			},
		},
		{ status: 201 },
	);
});

router.get('/transactions', async (request, env) => {
	const url = new URL(request.url);
	const limit = Number(url.searchParams.get('limit') ?? '50');
	const month = url.searchParams.get('month');

	const conditions = [];
	const bindings = [];
	if (month) {
		conditions.push("substr(t.occurred_on, 1, 7) = ?");
		bindings.push(month);
	}

	const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

	const query = `
    SELECT t.*, a.name AS account_name, c.name AS category_name, c.kind AS category_kind,
           counter.name AS counter_account_name
    FROM transactions t
    LEFT JOIN accounts a ON a.id = t.account_id
    LEFT JOIN categories c ON c.id = t.category_id
    LEFT JOIN accounts counter ON counter.id = t.counter_account_id
    ${whereClause}
    ORDER BY t.occurred_on DESC, t.created_at DESC
    LIMIT ?
  `;

	const result = await env.DB.prepare(query)
		.bind(...bindings, limit)
		.all();

	return json({
		data: result.results.map(mapTransactionRow),
	});
});

router.post('/transactions', async (request, env) => {
	const payload = transactionInput.parse(await parseJsonBody(request));
	const result = await createTransactionRecord(env, payload);

	return json({ data: result }, { status: 201 });
});

router.get('/transactions/:id', async (request, env) => {
	const { id } = request.params;
	const row = await fetchTransactionRow(env, id);
	if (!row) {
		throw createHttpError(404, 'Transaction not found');
	}
	const entries = await fetchTransactionEntries(env, id);

	return json({
		data: {
			...mapTransactionRow(row),
			entries,
		},
	});
});

router.patch('/transactions/:id', async (request, env) => {
	const { id } = request.params;
	const existing = await env.DB.prepare(`SELECT * FROM transactions WHERE id = ?`).bind(id).first();
	if (!existing) {
		throw createHttpError(404, 'Transaction not found');
	}

	const payload = transactionUpdateInput.parse(await parseJsonBody(request));
	const normalizedDate = payload.date ? ensureIsoDate(payload.date) : existing.occurred_on;
	const amountCents = payload.amount != null ? amountToCents(payload.amount) : existing.amount;
	const description = payload.description ?? existing.description;
	const memo = payload.memo ?? existing.memo;
	const paymentMethod = payload.paymentMethod ?? existing.payment_method;
	const accountId = payload.accountId ?? existing.account_id;
	const counterAccountId = payload.counterAccountId ?? existing.counter_account_id ?? null;
	const account = await getAccount(env, accountId);
	if (!account) {
		throw createHttpError(404, 'Account not found');
	}

	const categoryId = payload.categoryId ?? existing.category_id;
	const category = categoryId ? await getCategory(env, categoryId) : null;

	let direction = payload.direction ?? null;
	if (!direction) {
		if (category) {
			direction = category.kind === 'income' ? 'income' : category.kind === 'expense' ? 'expense' : 'transfer';
		} else {
			direction = existing.direction;
		}
	}

	if (direction === 'transfer' && !counterAccountId) {
		throw createHttpError(400, 'Transfer requires counter account');
	}
	if (direction !== 'transfer' && !category) {
		throw createHttpError(400, 'Category is required for this transaction');
	}

	const now = new Date().toISOString();
	const statements = [
		env.DB.prepare(
			`UPDATE transactions
       SET occurred_on = ?, direction = ?, description = ?, memo = ?, amount = ?, account_id = ?,
           category_id = ?, payment_method = ?, counter_account_id = ?, updated_at = ?
       WHERE id = ?`,
		).bind(
			normalizedDate,
			direction,
			description,
			memo ?? null,
			amountCents,
			account.id,
			category?.id ?? null,
			paymentMethod,
			counterAccountId,
			now,
			id,
		),
		env.DB.prepare(`DELETE FROM entries WHERE transaction_id = ?`).bind(id),
		...buildEntries({
			transactionId: id,
			direction,
			amountCents,
			accountId: account.id,
			categoryId: category?.id ?? null,
			counterAccountId,
		}).map((entry) =>
			env.DB.prepare(
				`INSERT INTO entries (id, transaction_id, ledger_type, ledger_id, side, amount)
         VALUES (?, ?, ?, ?, ?, ?)`,
			).bind(entry.id, entry.transactionId, entry.ledgerType, entry.ledgerId, entry.side, entry.amount),
		),
	];

	await env.DB.batch(statements);
	const updatedRow = await fetchTransactionRow(env, id);
	const entries = await fetchTransactionEntries(env, id);

	return json({
		data: {
			...mapTransactionRow(updatedRow),
			entries,
		},
	});
});

router.get('/transactions/suggestions', async (_request, env) => {
	const [accountUsageRows, categoryUsageRows, merchantRows, accountLookupRows, categoryLookupRows] = await Promise.all([
		env.DB.prepare(
			`SELECT a.id, a.name, a.type, COUNT(t.id) AS usage_count
       FROM accounts a
       LEFT JOIN transactions t ON t.account_id = a.id
       GROUP BY a.id
       HAVING usage_count > 0
       ORDER BY usage_count DESC
       LIMIT 5`,
		).all(),
		env.DB.prepare(
			`SELECT c.id, c.name, COUNT(t.id) AS usage_count
       FROM categories c
       LEFT JOIN transactions t ON t.category_id = c.id
       WHERE t.id IS NOT NULL
       GROUP BY c.id
       ORDER BY usage_count DESC
       LIMIT 6`,
		).all(),
		env.DB.prepare(
			`SELECT description,
        COUNT(*) AS usage_count,
        MAX(category_id) AS category_id,
        MAX(account_id) AS account_id
       FROM transactions
       WHERE description IS NOT NULL AND TRIM(description) != ''
       GROUP BY description
       ORDER BY usage_count DESC, MAX(occurred_on) DESC
       LIMIT 6`,
		).all(),
		env.DB.prepare(`SELECT id, name, type FROM accounts`).all(),
		env.DB.prepare(`SELECT id, name FROM categories`).all(),
	]);

	const accountMap = new Map(accountLookupRows.results.map((row) => [row.id, row]));
	const categoryMap = new Map(categoryLookupRows.results.map((row) => [row.id, row]));

	const merchants = merchantRows.results.map((row) => ({
		description: row.description,
		usage: row.usage_count,
		categoryId: row.category_id,
		categoryName: row.category_id ? categoryMap.get(row.category_id)?.name ?? null : null,
		accountId: row.account_id,
		accountName: row.account_id ? accountMap.get(row.account_id)?.name ?? null : null,
		accountType: row.account_id ? accountMap.get(row.account_id)?.type ?? null : null,
	}));

	return json({
		data: {
			accounts: accountUsageRows.results.map((row) => ({
				id: row.id,
				name: row.name,
				type: row.type,
			})),
			categories: categoryUsageRows.results.map((row) => ({
				id: row.id,
				name: row.name,
			})),
			merchants,
		},
	});
});

router.post('/demo/seed', async (request, env) => {
	authorizeDemoRequest(request, env);
	const url = new URL(request.url);
	const reset = url.searchParams.get('reset') === 'true';

	if (reset) {
		await env.DB.batch([
			env.DB.prepare('DELETE FROM entries'),
			env.DB.prepare('DELETE FROM transactions'),
			env.DB.prepare('DELETE FROM import_rows'),
			env.DB.prepare('DELETE FROM imports'),
		]);
	}

	await env.DB.batch([
		env.DB.prepare(`INSERT OR IGNORE INTO accounts (id, name, type, sort_order) VALUES ('acc-cash', '現金', 'cash', 1)`),
		env.DB.prepare(`INSERT OR IGNORE INTO accounts (id, name, type, sort_order) VALUES ('acc-paypay', 'PayPay銀行', 'bank', 2)`),
		env.DB.prepare(`INSERT OR IGNORE INTO accounts (id, name, type, sort_order) VALUES ('acc-credit', 'クレジットカード', 'credit', 3)`),
		env.DB.prepare(`INSERT OR IGNORE INTO categories (id, name, kind, color) VALUES ('cat-food', '食費', 'expense', '#f87171')`),
		env.DB.prepare(`INSERT OR IGNORE INTO categories (id, name, kind, color) VALUES ('cat-daily', '日用品', 'expense', '#fb923c')`),
		env.DB.prepare(`INSERT OR IGNORE INTO categories (id, name, kind, color) VALUES ('cat-transport', '交通費', 'expense', '#60a5fa')`),
		env.DB.prepare(`INSERT OR IGNORE INTO categories (id, name, kind, color) VALUES ('cat-entertainment', '娯楽', 'expense', '#a78bfa')`),
		env.DB.prepare(`INSERT OR IGNORE INTO categories (id, name, kind, color) VALUES ('cat-utilities', '光熱費', 'expense', '#34d399')`),
		env.DB.prepare(`INSERT OR IGNORE INTO categories (id, name, kind, color) VALUES ('cat-income', '給与収入', 'income', '#fbbf24')`),
	]);

	const makeDate = (offsetDays) => {
		const date = new Date(Date.now() - offsetDays * 24 * 60 * 60 * 1000);
		return date.toISOString().slice(0, 10);
	};

	const samples = [
		{
			date: makeDate(2),
			description: 'スターバックス',
			memo: '朝のコーヒー',
			amount: 620,
			accountId: 'acc-credit',
			categoryId: 'cat-food',
			paymentMethod: 'credit',
		},
		{
			date: makeDate(3),
			description: 'スーパー三徳',
			memo: '夕食食材',
			amount: 4320,
			accountId: 'acc-paypay',
			categoryId: 'cat-food',
			paymentMethod: 'bank',
		},
		{
			date: makeDate(4),
			description: '無印良品',
			amount: 2850,
			accountId: 'acc-credit',
			categoryId: 'cat-daily',
			paymentMethod: 'credit',
		},
		{
			date: makeDate(6),
			description: '都営地下鉄',
			amount: 780,
			accountId: 'acc-cash',
			categoryId: 'cat-transport',
			paymentMethod: 'cash',
		},
		{
			date: makeDate(8),
			description: 'Netflix',
			amount: 990,
			accountId: 'acc-credit',
			categoryId: 'cat-entertainment',
			paymentMethod: 'credit',
		},
		{
			date: makeDate(10),
			description: '電力会社',
			amount: 8540,
			accountId: 'acc-paypay',
			categoryId: 'cat-utilities',
			paymentMethod: 'bank',
		},
		{
			date: makeDate(15),
			description: '給与振込',
			amount: 250000,
			accountId: 'acc-paypay',
			categoryId: 'cat-income',
			paymentMethod: 'bank',
			direction: 'income',
			memo: '3月分給与',
		},
		{
			date: makeDate(1),
			description: '書店',
			memo: '技術書',
			amount: 1980,
			accountId: 'acc-credit',
			categoryId: 'cat-entertainment',
			paymentMethod: 'credit',
		},
	];

	for (const sample of samples) {
		await createTransactionRecord(env, {
			...sample,
			source: 'demo',
		});
	}

	return json({
		ok: true,
		inserted: samples.length,
		reset,
	});
});

router.get('/analytics/summary', async (_request, env) => {
	const [accounts, monthTotals] = await Promise.all([
		env.DB.prepare(
			`SELECT a.id, a.name, a.type, IFNULL(SUM(CASE WHEN e.side = 'debit' THEN e.amount ELSE -e.amount END), 0) AS balance
       FROM accounts a
       LEFT JOIN entries e ON e.ledger_type = 'account' AND e.ledger_id = a.id
       WHERE a.is_archived = 0
       GROUP BY a.id
       ORDER BY a.sort_order, a.created_at`,
		).all(),
		env.DB.prepare(
			`WITH current_month AS (
          SELECT substr(datetime('now'), 1, 7) AS month_key
        )
        SELECT
          SUM(CASE WHEN c.kind = 'income' AND e.side = 'credit' THEN e.amount
                   WHEN c.kind = 'income' AND e.side = 'debit' THEN -e.amount ELSE 0 END) AS income,
          SUM(CASE WHEN c.kind = 'expense' AND e.side = 'debit' THEN e.amount
                   WHEN c.kind = 'expense' AND e.side = 'credit' THEN -e.amount ELSE 0 END) AS expense
        FROM entries e
        INNER JOIN transactions t ON t.id = e.transaction_id
        INNER JOIN categories c ON c.id = e.ledger_id AND e.ledger_type = 'category'
        WHERE substr(t.occurred_on, 1, 7) = substr(datetime('now'), 1, 7)`,
		).first(),
	]);

	return json({
		data: {
			accounts: accounts.results.map((row) => ({
				id: row.id,
				name: row.name,
				type: row.type,
				balance: centsToAmount(row.balance),
			})),
			month: {
				income: centsToAmount(monthTotals?.income ?? 0),
				expense: centsToAmount(Math.abs(monthTotals?.expense ?? 0)),
				net: centsToAmount((monthTotals?.income ?? 0) - Math.abs(monthTotals?.expense ?? 0)),
			},
		},
	});
});

router.get('/analytics/monthly', async (_request, env) => {
	const rows = await env.DB.prepare(
		`SELECT substr(t.occurred_on, 1, 7) AS month_key,
        SUM(CASE WHEN c.kind = 'income' AND e.side = 'credit' THEN e.amount
                 WHEN c.kind = 'income' AND e.side = 'debit' THEN -e.amount ELSE 0 END) AS income,
        SUM(CASE WHEN c.kind = 'expense' AND e.side = 'debit' THEN e.amount
                 WHEN c.kind = 'expense' AND e.side = 'credit' THEN -e.amount ELSE 0 END) AS expense
      FROM entries e
      INNER JOIN transactions t ON t.id = e.transaction_id
      INNER JOIN categories c ON c.id = e.ledger_id AND e.ledger_type = 'category'
      GROUP BY month_key
      ORDER BY month_key DESC
      LIMIT 12`,
	).all();

	return json({
		data: rows.results
			.map((row) => ({
				month: row.month_key,
				income: centsToAmount(row.income ?? 0),
				expense: centsToAmount(Math.abs(row.expense ?? 0)),
				net: centsToAmount((row.income ?? 0) - Math.abs(row.expense ?? 0)),
			}))
			.reverse(),
	});
});

router.get('/analytics/categories', async (request, env) => {
	const url = new URL(request.url);
	const month = url.searchParams.get('month');
	const params = [];
	let condition = '';

	if (month) {
		condition = 'WHERE substr(t.occurred_on, 1, 7) = ?';
		params.push(month);
	}

	const rows = await env.DB.prepare(
		`SELECT c.id, c.name, c.kind,
        SUM(CASE WHEN e.side = 'debit' THEN e.amount ELSE -e.amount END) AS total
      FROM entries e
      INNER JOIN categories c ON c.id = e.ledger_id AND e.ledger_type = 'category'
      INNER JOIN transactions t ON t.id = e.transaction_id
      ${condition}
      GROUP BY c.id, c.name, c.kind
      ORDER BY total DESC`,
	)
		.bind(...params)
		.all();

	return json({
		data: rows.results.map((row) => ({
			id: row.id,
			name: row.name,
			kind: row.kind,
			total: centsToAmount(Math.abs(row.total ?? 0)),
		})),
	});
});

router.post('/imports/paypay', async (request, env) => {
	const contentType = request.headers.get('content-type') || '';
	if (!contentType.includes('multipart/form-data')) {
		throw createHttpError(400, 'multipart/form-data is required');
	}

	const formData = await request.formData();
	const file = formData.get('file');
	const accountId = formData.get('accountId');
	if (!(file instanceof File)) {
		throw createHttpError(400, 'CSV file is required');
	}
	if (!accountId) {
		throw createHttpError(400, 'accountId is required');
	}

	const csvText = await file.text();
	const parsed = Papa.parse(csvText, {
		header: true,
		skipEmptyLines: true,
		transformHeader: (header) => header.trim(),
	});

	if (parsed.errors.length) {
		throw createHttpError(400, `CSV parse error: ${parsed.errors[0].message}`);
	}

	const rows = parsed.data
		.map((row) => normalizePayPayRow(row))
		.filter((row) => row !== null);

	if (!rows.length) {
		throw createHttpError(400, 'No usable rows found');
	}

	const importId = crypto.randomUUID();
	const now = new Date().toISOString();
	const statements = [
		env.DB.prepare(
			`INSERT INTO imports (id, provider, account_id, original_filename, status, rows_count, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
		).bind(importId, 'paypay-bank', accountId, file.name, 'draft', rows.length, now),
		...rows.map((row) =>
			env.DB.prepare(
				`INSERT INTO import_rows (
           id, import_id, raw_payload, occurred_on, description, memo, amount, flow, status, created_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
        `,
			).bind(
				row.id,
				importId,
				JSON.stringify(row.raw),
				row.date,
				row.description,
				row.memo ?? null,
				row.amountCents,
				row.flow,
				now,
			),
		),
	];

	await env.DB.batch(statements);

	return json(
		{
			data: {
				importId,
				rows: rows.map((row) => ({
					id: row.id,
					date: row.date,
					description: row.description,
					amount: centsToAmount(row.amountCents),
					flow: row.flow,
				})),
			},
		},
		{ status: 201 },
	);
});

router.get('/imports/:id', async (request, env) => {
	const { id } = request.params;
	const rows = await env.DB.prepare(
		`SELECT ir.*, c.name AS category_name
      FROM import_rows ir
      LEFT JOIN categories c ON c.id = ir.category_id
      WHERE ir.import_id = ?
      ORDER BY ir.occurred_on`,
	)
		.bind(id)
		.all();

	if (!rows.results.length) {
		throw createHttpError(404, 'Import not found');
	}

	return json({
		data: rows.results.map((row) => ({
			id: row.id,
			date: row.occurred_on,
			description: row.description,
			memo: row.memo,
			amount: centsToAmount(row.amount),
			flow: row.flow,
			categoryId: row.category_id,
			categoryName: row.category_name,
			status: row.status,
		})),
	});
});

router.post('/imports/:id/confirm', async (request, env) => {
	const { id } = request.params;
	const payload = confirmImportSchema.parse(await parseJsonBody(request));

	const rows = await env.DB.prepare(
		`SELECT ir.*, im.account_id
       FROM import_rows ir
       INNER JOIN imports im ON im.id = ir.import_id
       WHERE ir.import_id = ? AND ir.id IN (${payload.rows.map(() => '?').join(',')})
       AND ir.status = 'pending'`,
	)
		.bind(id, ...payload.rows.map((row) => row.rowId))
		.all();

	if (!rows.results.length) {
		throw createHttpError(404, 'Import rows not found');
	}

	const categoryMap = new Map(payload.rows.map((row) => [row.rowId, row.categoryId]));

	const statements = [];
	for (const row of rows.results) {
		const categoryId = categoryMap.get(row.id);
		if (!categoryId) continue;
		const category = await getCategory(env, categoryId);
		if (!category) {
			throw createHttpError(400, 'Category not found');
		}
		const direction = row.flow === 'inflow' ? 'income' : 'expense';
		const transactionId = crypto.randomUUID();
		const now = new Date().toISOString();
		statements.push(
			env.DB.prepare(
				`INSERT INTO transactions (
          id, occurred_on, direction, description, memo, amount,
          account_id, category_id, payment_method, source, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'import:paypay', ?, ?)`,
			).bind(
				transactionId,
				row.occurred_on,
				direction,
				row.description,
				row.memo ?? null,
				row.amount,
				row.account_id,
				categoryId,
				'bank',
				now,
				now,
			),
		);
		buildEntries({
			transactionId,
			direction,
			amountCents: row.amount,
			accountId: row.account_id,
			categoryId,
		}).forEach((entry) =>
			statements.push(
				env.DB.prepare(
					`INSERT INTO entries (id, transaction_id, ledger_type, ledger_id, side, amount)
           VALUES (?, ?, ?, ?, ?, ?)`,
				).bind(entry.id, entry.transactionId, entry.ledgerType, entry.ledgerId, entry.side, entry.amount),
			),
		);
		statements.push(
			env.DB.prepare(`UPDATE import_rows SET status = 'completed', category_id = ?, transaction_id = ? WHERE id = ?`).bind(
				categoryId,
				transactionId,
				row.id,
			),
		);
	}

	if (!statements.length) {
		throw createHttpError(400, 'No valid rows to import');
	}

	await env.DB.batch(statements);

	return json({ ok: true });
});

router.get('/analytics/sankey', async (_request, env) => {
	const rows = await env.DB.prepare(
		`SELECT c.name AS category_name, a.name AS account_name, SUM(t.amount) AS total
       FROM transactions t
       INNER JOIN categories c ON c.id = t.category_id
       INNER JOIN accounts a ON a.id = t.account_id
       WHERE t.direction = 'expense'
       GROUP BY c.name, a.name
       ORDER BY total DESC
       LIMIT 20`,
	).all();

	return json({
		data: rows.results.map((row) => ({
			source: row.account_name,
			target: row.category_name,
			value: centsToAmount(row.total ?? 0),
		})),
	});
});

const mapTransactionRow = (row) => ({
	id: row.id,
	date: row.occurred_on,
	description: row.description,
	memo: row.memo,
	amount: centsToAmount(row.amount),
	accountId: row.account_id,
	accountName: row.account_name,
	categoryId: row.category_id,
	categoryName: row.category_name,
	categoryKind: row.category_kind,
	paymentMethod: row.payment_method,
	direction: row.direction,
	source: row.source,
	counterAccountId: row.counter_account_id,
	counterAccountName: row.counter_account_name,
});

const authorizeDemoRequest = (request, env) => {
	if (!env.DEMO_TOKEN) {
		throw createHttpError(403, 'Demo seeding is disabled');
	}

	const authHeader = request.headers.get('authorization') || '';
	const token = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : authHeader;
	if (token !== env.DEMO_TOKEN) {
		throw createHttpError(403, 'Invalid demo token');
	}
};

const getAccount = (env, id) => env.DB.prepare(`SELECT * FROM accounts WHERE id = ?`).bind(id).first();
const getCategory = (env, id) => env.DB.prepare(`SELECT * FROM categories WHERE id = ?`).bind(id).first();

const fetchTransactionRow = (env, id) =>
	env.DB.prepare(
		`SELECT t.*, a.name AS account_name, c.name AS category_name, c.kind AS category_kind,
          counter.name AS counter_account_name
     FROM transactions t
     LEFT JOIN accounts a ON a.id = t.account_id
     LEFT JOIN categories c ON c.id = t.category_id
     LEFT JOIN accounts counter ON counter.id = t.counter_account_id
     WHERE t.id = ?`,
	)
		.bind(id)
		.first();

const fetchTransactionEntries = async (env, transactionId) => {
	const result = await env.DB.prepare(
		`SELECT e.*, COALESCE(a.name, c.name) AS ledger_name,
        CASE WHEN e.ledger_type = 'account' THEN a.type ELSE c.kind END AS ledger_meta
     FROM entries e
     LEFT JOIN accounts a ON e.ledger_type = 'account' AND e.ledger_id = a.id
     LEFT JOIN categories c ON e.ledger_type = 'category' AND e.ledger_id = c.id
     WHERE e.transaction_id = ?
     ORDER BY CASE WHEN e.side = 'debit' THEN 0 ELSE 1 END`,
	)
		.bind(transactionId)
		.all();

	return result.results.map((entry) => ({
		id: entry.id,
		ledgerType: entry.ledger_type,
		ledgerId: entry.ledger_id,
		ledgerName: entry.ledger_name,
		ledgerMeta: entry.ledger_meta,
		side: entry.side,
		amount: centsToAmount(entry.amount),
	}));
};

const createTransactionRecord = async (env, payload) => {
	const normalizedDate = ensureIsoDate(payload.date);
	const amountCents = amountToCents(payload.amount);
	const account = await getAccount(env, payload.accountId);
	if (!account) throw createHttpError(404, 'Account not found');

	const category = payload.categoryId ? await getCategory(env, payload.categoryId) : null;
	let direction = payload.direction;
	if (!direction) {
		if (category?.kind === 'income') {
			direction = 'income';
		} else if (category?.kind === 'expense') {
			direction = 'expense';
		} else if (payload.counterAccountId) {
			direction = 'transfer';
		} else {
			direction = 'expense';
		}
	}

	if (direction === 'transfer' && !payload.counterAccountId) {
		throw createHttpError(400, 'Transfer requires counter account');
	}
	if (direction !== 'transfer' && !category) {
		throw createHttpError(400, 'Category is required for this transaction');
	}

	const transactionId = crypto.randomUUID();
	const now = new Date().toISOString();
	const statements = [
		env.DB.prepare(
			`INSERT INTO transactions (
        id, occurred_on, direction, description, memo, amount,
        account_id, category_id, payment_method, counter_account_id, source, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		).bind(
			transactionId,
			normalizedDate,
			direction,
			payload.description,
			payload.memo ?? null,
			amountCents,
			account.id,
			category?.id ?? null,
			payload.paymentMethod,
			payload.counterAccountId ?? null,
			payload.source ?? 'manual',
			now,
			now,
		),
		...buildEntries({
			transactionId,
			direction,
			amountCents,
			accountId: account.id,
			categoryId: category?.id ?? null,
			counterAccountId: payload.counterAccountId ?? null,
		}).map((entry) =>
			env.DB.prepare(
				`INSERT INTO entries (id, transaction_id, ledger_type, ledger_id, side, amount)
         VALUES (?, ?, ?, ?, ?, ?)`,
			).bind(entry.id, entry.transactionId, entry.ledgerType, entry.ledgerId, entry.side, entry.amount),
		),
	];

	await env.DB.batch(statements);

	return {
		id: transactionId,
		date: normalizedDate,
		description: payload.description,
		memo: payload.memo ?? null,
		amount: centsToAmount(amountCents),
		accountId: account.id,
		categoryId: category?.id ?? null,
		direction,
		paymentMethod: payload.paymentMethod,
		source: payload.source ?? 'manual',
	};
};

const buildEntries = ({ transactionId, direction, amountCents, accountId, categoryId, counterAccountId }) => {
	if (direction === 'transfer') {
		if (!counterAccountId) {
			throw createHttpError(400, 'Transfer requires counter account');
		}
		return [
			{
				id: crypto.randomUUID(),
				transactionId,
				ledgerType: 'account',
				ledgerId: counterAccountId,
				side: 'debit',
				amount: amountCents,
			},
			{
				id: crypto.randomUUID(),
				transactionId,
				ledgerType: 'account',
				ledgerId: accountId,
				side: 'credit',
				amount: amountCents,
			},
		];
	}

	if (!categoryId) {
		throw createHttpError(400, 'Category is required for this transaction');
	}

	if (direction === 'income') {
		return [
			{
				id: crypto.randomUUID(),
				transactionId,
				ledgerType: 'account',
				ledgerId: accountId,
				side: 'debit',
				amount: amountCents,
			},
			{
				id: crypto.randomUUID(),
				transactionId,
				ledgerType: 'category',
				ledgerId: categoryId,
				side: 'credit',
				amount: amountCents,
			},
		];
	}

	return [
		{
			id: crypto.randomUUID(),
			transactionId,
			ledgerType: 'category',
			ledgerId: categoryId,
			side: 'debit',
			amount: amountCents,
		},
		{
			id: crypto.randomUUID(),
			transactionId,
			ledgerType: 'account',
			ledgerId: accountId,
			side: 'credit',
			amount: amountCents,
		},
	];
};

const normalizePayPayRow = (raw) => {
	const dateField = raw['入出金日'] || raw['取引日'] || raw['日付'];
	const outgoingRaw = raw['出金額'] ?? raw['出金'] ?? raw['出金金額'];
	const incomingRaw = raw['入金額'] ?? raw['入金'] ?? raw['入金金額'];
	const description = raw['摘要'] || raw['内容'] || raw['備考'] || raw['メモ'];

	if (!dateField || !(incomingRaw || outgoingRaw)) return null;

	const date = ensureIsoDate(dateField);
	const incoming = amountFromCsv(incomingRaw);
	const outgoing = amountFromCsv(outgoingRaw);
	let flow = 'outflow';
	let amount = outgoing || incoming;
	if (incoming > 0) {
		flow = 'inflow';
		amount = incoming;
	}
	if (!amount) return null;
	return {
		id: crypto.randomUUID(),
		date,
		description: description?.trim() || 'PayPay取引',
		memo: raw['メモ'] ?? null,
		amountCents: amount,
		flow,
		raw,
	};
};

const amountFromCsv = (value) => {
	if (!value) return 0;
	const normalized = String(value).replace(/[^\d.-]/g, '').trim();
	if (!normalized) return 0;
	return Math.abs(Math.round(Number(normalized) * 100));
};

router.all('*', () => {
	throw createHttpError(404, 'Not found');
});

export default {
	async fetch(request, env, ctx) {
		const url = new URL(request.url);
		if (!url.pathname.startsWith('/api')) {
			return env.ASSETS.fetch(request, env, ctx);
		}

		try {
			return await router.handle(request, env, ctx);
		} catch (error) {
			console.error('API error', error);
			const status = error.status || 500;
			return json(
				{
					error: error.message || 'Internal Server Error',
				},
				{ status },
			);
		}
	},
};
