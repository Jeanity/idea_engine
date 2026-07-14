// Side-effect env loader for scripts. Import this FIRST, before any module
// under src/ — ES module imports are hoisted and evaluated in declaration
// order, so a bare `config()` call in the script body runs AFTER every
// import. That bit warm-evergreen.ts live (2026-07-14): src/lib/ai.ts
// constructs its Anthropic client at module scope, so the client was built
// with apiKey undefined and all 40 warm calls failed with "Could not resolve
// authentication method" — while the script's own env *checks* passed,
// because they ran after config(). Importing this module first makes the env
// available to every subsequently-evaluated module's top-level code.
import { config } from 'dotenv'

config({ path: '.env.local' })
