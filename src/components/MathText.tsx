import { Fragment } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";
/** Only KaTeX creates markup. Plain text is always escaped by React; trust is disabled. */
export function MathText({ text }: { text: string }) {
  const parts = text.split(/(\$\$[\s\S]+?\$\$|\$[^$\n]+\$)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("$") && part.endsWith("$") && part.length > 2) {
          const display = part.startsWith("$$"),
            formula = part.slice(display ? 2 : 1, display ? -2 : -1);
          try {
            return (
              <span
                key={i}
                className={display ? "math-block" : "math-inline"}
                dangerouslySetInnerHTML={{
                  __html: katex.renderToString(formula, {
                    throwOnError: true,
                    trust: false,
                    strict: "error",
                    displayMode: display,
                    output: "htmlAndMathml",
                  }),
                }}
              />
            );
          } catch {
            return <code key={i}>{part}</code>;
          }
        }
        return <Fragment key={i}>{part}</Fragment>;
      })}
    </>
  );
}
