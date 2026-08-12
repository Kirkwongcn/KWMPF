import { appendFile, readFile, stat } from "node:fs/promises";

export async function downloadPdfInRanges(url: string, file: string, chunkSize = 512 * 1024): Promise<Uint8Array> {
  const head = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(15_000) });
  const length = Number(head.headers.get("content-length"));
  if (!Number.isInteger(length) || length <= 0) throw new Error("PDF content length is missing");
  if (head.headers.get("accept-ranges")?.toLowerCase() !== "bytes") throw new Error("PDF endpoint does not support byte ranges");
  let start = await stat(file).then((value) => value.size).catch(() => 0);
  if (start > length) throw new Error("existing PDF is larger than the remote file");
  for (; start < length; start += chunkSize) {
    const end = Math.min(start + chunkSize, length) - 1;
    const response = await fetch(url, { headers: { Range: `bytes=${start}-${end}` }, signal: AbortSignal.timeout(20_000) });
    if (response.status !== 206) throw new Error(`PDF range request returned HTTP ${response.status}`);
    const range = response.headers.get("content-range");
    if (range !== `bytes ${start}-${end}/${length}`) throw new Error(`PDF range response mismatch: ${range ?? "missing"}`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.length !== end - start + 1) throw new Error(`PDF range length mismatch at ${start}`);
    await appendFile(file, bytes);
  }
  const bytes = await readFile(file);
  if (bytes.length !== length || String.fromCharCode(...bytes.slice(0, 4)) !== "%PDF") throw new Error("downloaded file is not a complete PDF");
  return bytes;
}
