import {
  answerSchema,
  type Answer,
  type Question,
  type Solution,
} from "../types/practice";
/** Parse a bounded decimal or fraction without eval or floating-point approximation. */
export function parseNumeric(value: string): {
  numerator: bigint;
  denominator: bigint;
} {
  if (value.length > 80) throw new Error("INVALID_NUMBER");
  const input = value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
  if (
    !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:\/[+-]?(?:\d+(?:\.\d*)?|\.\d+))?$/.test(
      input,
    )
  )
    throw new Error("INVALID_NUMBER");
  function decimal(v: string) {
    const sign = v.startsWith("-") ? -1n : 1n;
    v = v.replace(/^[+-]/, "");
    const [whole, fraction = ""] = v.split(".");
    return {
      n: sign * BigInt((whole || "0") + fraction),
      d: 10n ** BigInt(fraction.length),
    };
  }
  const [a, b] = input.split("/"),
    left = decimal(a),
    right = b ? decimal(b) : { n: 1n, d: 1n };
  if (right.n === 0n) throw new Error("INVALID_NUMBER");
  let n = left.n * right.d,
    d = left.d * right.n;
  if (d < 0n) {
    n = -n;
    d = -d;
  }
  const gcd = (a: bigint, b: bigint): bigint =>
    b === 0n ? (a < 0n ? -a : a) : gcd(b, a % b);
  const divisor = gcd(n, d);
  return { numerator: n / divisor, denominator: d / divisor };
}
export function equivalentNumeric(a: string, b: string) {
  const x = parseNumeric(a),
    y = parseNumeric(b);
  return x.numerator * y.denominator === y.numerator * x.denominator;
}
export function validateAnswer(question: Question, input: Answer): Answer {
  const result = answerSchema.safeParse(input);
  if (!result.success) throw new Error("ANSWER_FORMAT");
  const answer = result.data;
  if (question.format === "numeric") {
    if (answer.numeric === undefined) throw new Error("ANSWER_FORMAT");
    parseNumeric(answer.numeric);
    return answer;
  }
  if (question.format === "blanks") {
    if (!answer.blanks || answer.blanks.length !== question.blank_count)
      throw new Error("ANSWER_INCOMPLETE");
    if (
      answer.blanks.some(
        (key, index) =>
          !question.options.some(
            (o) => o.key === key && o.blank_index === index,
          ),
      )
    )
      throw new Error("ANSWER_OPTION");
    return answer;
  }
  if (!answer.choices || answer.choices.length !== question.selection_count)
    throw new Error("ANSWER_INCOMPLETE");
  if (
    new Set(answer.choices).size !== answer.choices.length ||
    answer.choices.some((key) => !question.options.some((o) => o.key === key))
  )
    throw new Error("ANSWER_OPTION");
  return answer;
}
export function gradeAnswer(
  question: Question,
  solution: Solution,
  input: Answer,
) {
  const answer = validateAnswer(question, input);
  if (question.format === "numeric")
    return equivalentNumeric(answer.numeric!, solution.answer.numeric!);
  if (question.format === "blanks")
    return (
      JSON.stringify(answer.blanks) === JSON.stringify(solution.answer.blanks)
    );
  return (
    JSON.stringify([...answer.choices!].sort()) ===
    JSON.stringify([...solution.answer.choices!].sort())
  );
}
export function answerLabel(question: Question, answer: Answer) {
  if (answer.numeric !== undefined) return answer.numeric;
  if (answer.blanks)
    return answer.blanks
      .map(
        (key, i) =>
          `${i + 1}: ${question.options.find((o) => o.key === key)?.text ?? key}`,
      )
      .join(" · ");
  return (answer.choices ?? [])
    .map(
      (key) =>
        `${key}. ${question.options.find((o) => o.key === key)?.text ?? key}`,
    )
    .join(" / ");
}
