import { z } from 'zod';
// Configure before any application schema is constructed. Strict CSP forbids JIT/eval probes.
z.config({jitless:true});
export { z };
