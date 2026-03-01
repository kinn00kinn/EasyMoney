import { argv, env } from 'node:process';

const token = env.DEMO_TOKEN;
if (!token) {
	console.error('DEMO_TOKEN 環境変数を設定してください。（Cloudflare wrangler vars と同じ値）');
	process.exit(1);
}

const args = argv.slice(2);
let url = 'http://127.0.0.1:8787/api/demo/seed';
for (const arg of args) {
	if (arg.startsWith('--url=')) {
		url = arg.replace('--url=', '');
	}
}

console.log(`POST ${url}`);

const response = await fetch(url, {
	method: 'POST',
	headers: {
		Authorization: `Bearer ${token}`,
	},
});

if (!response.ok) {
	const text = await response.text();
	console.error(`Failed (${response.status}): ${text}`);
	process.exit(1);
}

const data = await response.json();
console.log(JSON.stringify(data, null, 2));
