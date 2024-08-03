import { defineConfig } from 'drizzle-kit'

export default defineConfig({
    schema: [
        "src/backend/db/**/*.schema.ts",
        "src/backend/db/**/*.schema.tsx"
    ],
    out: "drizzle/migrations",
    dialect: "sqlite",
});