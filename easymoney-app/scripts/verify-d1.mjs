import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const configPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'wrangler.jsonc');

const readJsonc = (filePath) => {
	const content = fs.readFileSync(filePath, 'utf8');
	const stripped = content.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
	return JSON.parse(stripped);
};

const config = readJsonc(configPath);
const binding = config.d1_databases?.[0];
const databaseId = binding?.database_id;

const isPlaceholder = !databaseId || databaseId === '__REPLACE_WITH_D1_ID__';

if (isPlaceholder) {
	console.error('Error: No Cloudflare D1 database_id configured.');
	console.error('Run "npm run configure:d1 <database-id>" before deploying.');
	process.exit(1);
}

console.log(`Using D1 database (${binding.database_name}) with id: ${databaseId}`);
