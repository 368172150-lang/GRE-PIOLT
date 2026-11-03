import rows from "./questions.json";
import {
  questionSchema,
  solutionSchema,
  type Question,
  type Solution,
} from "../types/practice";
export const originalQuestions: Question[] = rows
  .filter((row) => row.review_status === "reviewed")
  .map(({ solution, ...question }) => {
    void solution;
    return questionSchema.parse(question);
  });
export const originalSolutions: Record<string, Solution> = Object.fromEntries(
  rows
    .filter((row) => row.review_status === "reviewed")
    .map((row) => [row.id, solutionSchema.parse(row.solution)]),
);
export const originalBank = {
  questions: originalQuestions,
  solutions: originalSolutions,
};
