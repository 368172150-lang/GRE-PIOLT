import type { StudySnapshot } from "./study";
import type { VocabSnapshot } from "./vocabulary";
import type { PracticeSnapshot } from "./practice";
import type { WritingSnapshot } from "./writing";
export interface InsightsSource {
  study: StudySnapshot;
  vocabulary: VocabSnapshot;
  practice: PracticeSnapshot;
  writing: WritingSnapshot;
}
