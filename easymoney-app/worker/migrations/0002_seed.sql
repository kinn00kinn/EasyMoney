INSERT OR IGNORE INTO accounts (id, name, type, sort_order)
VALUES
  ('acc-cash', '現金', 'cash', 1),
  ('acc-paypay', 'PayPay銀行', 'bank', 2),
  ('acc-credit', 'クレジットカード', 'credit', 3);

INSERT OR IGNORE INTO categories (id, name, kind, color)
VALUES
  ('cat-food', '食費', 'expense', '#f87171'),
  ('cat-daily', '日用品', 'expense', '#fb923c'),
  ('cat-transport', '交通費', 'expense', '#60a5fa'),
  ('cat-entertainment', '娯楽', 'expense', '#a78bfa'),
  ('cat-utilities', '光熱費', 'expense', '#34d399'),
  ('cat-income', '給与収入', 'income', '#fbbf24'),
  ('cat-others', 'その他', 'expense', '#94a3b8');
