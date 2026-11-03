import { createServer } from "vite";
import type { FullConfig } from "@playwright/test";
import { startStatic } from "../scripts/serve-static.mjs";
/** Keep the server in-process so Windows teardown never depends on killing a shell tree. */
export default async function setup(config: FullConfig) {
  if (config.metadata.pilotServerMode === "preview") {
    const server = await startStatic("dist", 4173);
    return async () => {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    };
  }
  const server = await createServer({
    server: { host: "127.0.0.1", port: 5180, strictPort: true },
  });
  await server.listen();
  return async () => {
    if (server.httpServer && "closeAllConnections" in server.httpServer)
      server.httpServer.closeAllConnections();
    await server.close();
  };
}
