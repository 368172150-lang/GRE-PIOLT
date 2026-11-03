import {
  snapshotSchema,
  emptySnapshot,
  type StudySnapshot,
} from "../types/study";
const key = "gre-pilot:local-experience:study:v2";
export function readLocalStudy() {
  const raw = localStorage.getItem(key);
  try {
    return raw ? snapshotSchema.parse(JSON.parse(raw)) : emptySnapshot();
  } catch {
    throw new Error("LOCAL_DATA_INVALID");
  }
}
export function writeLocalStudy(state: StudySnapshot) {
  localStorage.setItem(key, JSON.stringify(state));
}
export async function withStudyLock<T>(work: () => Promise<T>): Promise<T> {
  if (!navigator.locks) throw new Error("WEB_LOCKS_REQUIRED");
  return await navigator.locks.request("gre-pilot-local-study", work);
}
