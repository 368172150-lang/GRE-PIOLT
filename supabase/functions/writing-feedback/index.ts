// Deploy only when explicitly enabling the optional service. Secrets stay in the Edge environment.
import { createClient } from "npm:@supabase/supabase-js@2";
import { createFeedbackHandler } from "./handler.ts";
declare const Deno: {
  env: { get: (key: string) => string | undefined };
  serve: (handler: (r: Request) => Promise<Response>) => void;
};
const env = (key: string) => Deno.env.get(key) ?? "";
Deno.serve(async (req: Request) => {
  const url = env("SUPABASE_URL"),
    anon = env("SUPABASE_ANON_KEY"),
    serviceKey = env("SUPABASE_SERVICE_ROLE_KEY"),
    providerUrl = env("AI_FEEDBACK_URL"),
    providerKey = env("AI_FEEDBACK_KEY"),
    origin = env("APP_ORIGIN");
  const userClient = createClient(url, anon, {
    global: {
      headers: { Authorization: req.headers.get("Authorization") ?? "" },
    },
    auth: { persistSession: false },
  });
  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false },
  });
  const handler = createFeedbackHandler(
    {
      authenticate: async () => {
        const { data, error } = await userClient.auth.getUser();
        return error ? null : (data.user?.id ?? null);
      },
      read: async (id) => {
        const { data, error } = await userClient
          .from("writing_submissions")
          .select("id,revision,prompt,body,completed_at")
          .eq("id", id)
          .maybeSingle();
        if (error) throw error;
        return data;
      },
      reserve: async (id, revision) => {
        const { data, error } = await userClient.rpc(
          "writing_feedback_reserve",
          { p_id: id, p_revision: revision },
        );
        if (error) throw error;
        return data;
      },
      store: async (user, id, revision, feedback) => {
        const { error } = await admin.rpc("writing_feedback_store", {
          p_user: user,
          p_id: id,
          p_revision: revision,
          p_feedback: feedback,
        });
        if (error) throw error;
      },
      provider: async (payload) => {
        const response = await fetch(providerUrl, {
          method: "POST",
          redirect: "error",
          headers: {
            Authorization: `Bearer ${providerKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(25000),
        });
        if (!response.ok || !response.body) throw new Error("PROVIDER_FAILED");
        const reader = response.body.getReader(),
          chunks: Uint8Array[] = [];
        let size = 0;
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > 100000) {
            await reader.cancel();
            throw new Error("PROVIDER_TOO_LARGE");
          }
          chunks.push(value);
        }
        const bytes = new Uint8Array(size);
        let offset = 0;
        for (const c of chunks) {
          bytes.set(c, offset);
          offset += c.byteLength;
        }
        return JSON.parse(new TextDecoder().decode(bytes));
      },
    },
    origin,
    !!origin && /^https:\/\//.test(providerUrl) && !!providerKey,
  );
  return handler(req);
});
