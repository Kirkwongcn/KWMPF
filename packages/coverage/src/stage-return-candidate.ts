import { copyFile, readFile } from "node:fs/promises";
import { isDeepStrictEqual } from "node:util";

// The tracked base and destination can be the same file on a second run today.
export async function stageReturnCandidate(
  base: string,
  candidate: string,
  report: string,
  output: string,
  reportOutput: string,
) {
  const read = async (path: string) => JSON.parse(await readFile(path, "utf8"));
  if (isDeepStrictEqual(await read(base), await read(candidate))) return false;
  await copyFile(report, reportOutput);
  await copyFile(candidate, output);
  return true;
}

if (import.meta.main) {
  const [base, candidate, report, output, reportOutput] = process.argv.slice(2);
  if (!base || !candidate || !report || !output || !reportOutput)
    throw new Error(
      "Expected base, built candidate, built report, output candidate and output report",
    );
  console.log(
    "changed=" +
      (await stageReturnCandidate(
        base,
        candidate,
        report,
        output,
        reportOutput,
      )),
  );
}
