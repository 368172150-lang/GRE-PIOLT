import { z } from "../lib/validation";
import type { WritingDocument } from "../types/writing";
const recoverySchema = z.object({
  body: z.string().max(60000),
  notes: z.string().max(10000),
  revision: z.number().int().nonnegative(),
});
export type WritingRecovery = z.infer<typeof recoverySchema>;
const key = (id: string, userId?: string) =>
  `gre-pilot:writing-recovery:v1:${userId ?? "local"}:${id}`;
/** Tab-scoped safety buffer, separate from the authoritative saved essay. Never sent to AI. */
export function readWritingRecovery(
  doc: WritingDocument,
  userId?: string,
): WritingRecovery | null {
  try {
    const raw = sessionStorage.getItem(key(doc.id, userId));
    if (!raw) return null;
    const value = recoverySchema.parse(JSON.parse(raw));
    return value.body === doc.body && value.notes === doc.notes ? null : value;
  } catch {
    return null;
  }
}
export function saveWritingRecovery(
  id: string,
  value: WritingRecovery,
  userId?: string,
) {
  try {
    sessionStorage.setItem(
      key(id, userId),
      JSON.stringify(recoverySchema.parse(value)),
    );
    return true;
  } catch {
    return false;
  }
}
export function clearWritingRecovery(id: string, userId?: string) {
  try {
    sessionStorage.removeItem(key(id, userId));
  } catch {
    /* The saved server/local document remains authoritative. */
  }
}
