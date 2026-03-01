import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { cloudflare } from '@cloudflare/vite-plugin';

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
	plugins: [react(), mode === 'test' ? null : cloudflare()].filter(Boolean),
	test: {
		environment: 'node',
	},
}));
