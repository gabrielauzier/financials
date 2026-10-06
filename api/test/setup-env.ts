import { getLocalStack } from './helpers/stack.js';

// buildApp() without arguments reads its config from the environment; point it at the local stack.
const stack = getLocalStack();
process.env.SUPABASE_URL ??= stack.apiUrl;
process.env.DATABASE_URL ??= stack.dbUrl;
