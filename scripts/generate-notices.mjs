/* global console */
import fs from "node:fs";
import path from "node:path";
const lock = JSON.parse(fs.readFileSync("package-lock.json", "utf8"));
let notice =
  "GRE Pilot — third-party production dependency notices\nGenerated from the installed, locked dependencies. Project code has its own MIT LICENSE.\n";
for (const [directory, metadata] of Object.entries(lock.packages).sort(
  ([a], [b]) => a.localeCompare(b),
)) {
  if (
    !directory ||
    metadata.dev ||
    !fs.existsSync(path.join(directory, "package.json"))
  )
    continue;
  const pkg = JSON.parse(
    fs.readFileSync(path.join(directory, "package.json"), "utf8"),
  );
  notice += `\n${"=".repeat(72)}\n${pkg.name} ${pkg.version}\nLicense metadata: ${pkg.license ?? "See package license"}\n`;
  const files = fs
    .readdirSync(directory)
    .filter((name) =>
      /^(LICENSE|LICENCE|COPYING|NOTICE)(\.[a-z]+)?$/i.test(name),
    );
  for (const file of files)
    if (fs.statSync(path.join(directory, file)).isFile())
      notice += `\n--- ${file} ---\n${fs.readFileSync(path.join(directory, file), "utf8")}\n`;
}
fs.mkdirSync("public", { recursive: true });
fs.writeFileSync("public/third-party-notices.txt", notice);
console.log("Generated production dependency license notices.");
