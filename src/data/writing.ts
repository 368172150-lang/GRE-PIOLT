/** Original AI-assisted Issue prompts, author reviewed; not official ETS content. */
import prompts from "./writing.json";
export const issuePrompts = prompts.filter(
  (p) => p.review_status === "reviewed",
);
