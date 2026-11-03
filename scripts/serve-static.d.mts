import type { Server } from "node:http";
export function startStatic(root: string, port?: number): Promise<Server>;
