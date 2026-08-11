import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";

type Link = { scheme: string; factSheetUrl: string };
type Entry = Link & { status: "downloaded" | "failed"; retrievedAt: string; sha256?: string; error?: string };

const input = process.argv[2];
const output = process.argv[3];
if (!input || !output) throw new Error("Usage: bun fetch-fact-sheets.ts <links.json> <manifest.json>");
const manifestPath = output;

const links = JSON.parse(await readFile(input, "utf8")) as Link[];
const root = output.replace(/\.json$/, "");
await mkdir(root, { recursive: true });
const existing = await readFile(manifestPath, "utf8").then((value) => JSON.parse(value).entries as Entry[]).catch(() => [] as Entry[]);
const entries: Entry[] = [...existing];

async function save() {
  await writeFile(manifestPath, `${JSON.stringify({ generatedAt: new Date().toISOString(), entries }, null, 2)}\n`);
}

for (const link of links) {
  const id = createHash("sha256").update(link.scheme).digest("hex").slice(0, 16);
  const file = `${root}/${id}.pdf`;
  if (entries.some((entry) => entry.scheme === link.scheme && entry.status === "downloaded")) continue;
  const retrievedAt = new Date().toISOString();
  try {
    const response = await fetch(link.factSheetUrl, { signal: AbortSignal.timeout(15_000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.length < 10_000 || String.fromCharCode(...bytes.slice(0, 4)) !== "%PDF") throw new Error("response is not a PDF");
    await writeFile(file, bytes, { flag: "wx" }).catch(async (error: NodeJS.ErrnoException) => {
      if (error.code !== "EEXIST") throw error;
    });
    entries.push({ ...link, status: "downloaded", retrievedAt, sha256: createHash("sha256").update(bytes).digest("hex") });
  } catch (error) {
    entries.push({ ...link, status: "failed", retrievedAt, error: error instanceof Error ? error.message : String(error) });
  }
  await save();
}

await save();
console.log(JSON.stringify({ output, downloaded: entries.filter((entry) => entry.status === "downloaded").length, failed: entries.filter((entry) => entry.status === "failed").length }));
