import { configDefaults, defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    // Rules tests need the Firestore emulator; they run via `npm run test:regras`.
    exclude: [...configDefaults.exclude, 'tests/firestore.rules.test.ts'],
  },
})
