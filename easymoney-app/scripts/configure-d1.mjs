import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const [, , idArg, nameArg] = process.argv;

if (!idArg) {
	console.error('Usage: npm run configure:d1 <database-id> [database-name]');
	process.exit(1);
}

const configPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'wrangler.jsonc');

const readJsonc = (filePath) => {
	const content = fs.readFileSync(filePath, 'utf8');
	const stripped = content.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
	return JSON.parse(stripped);
};

const config = readJsonc(configPath);
if (!Array.isArray(config.d1_databases) || !config.d1_databases.length) {
	throw new Error('No d1_databases entry found in wrangler.jsonc');
}

config.d1_databases[0].database_id = idArg;
if (nameArg) {
	config.d1_databases[0].database_name = nameArg;
}

fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
console.log(`Updated D1 binding to use id "${idArg}"`);
