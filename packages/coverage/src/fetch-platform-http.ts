import {
  archiveHtml,
  failedFetchArtifact,
  type RawArtifact,
} from "./raw-archive";

const MAX_HTML_BYTES = 5 * 1024 * 1024;

export type FetchFailure = {
  attempt: number;
  retrievedAt: string;
  httpStatus?: number;
  html?: string;
  error: string;
};

export type FetchHtmlOptions = {
  fetchImpl?: typeof fetch;
  wait?: (milliseconds: number) => Promise<void>;
};

export async function fetchAndArchiveHtml(
  url: string,
  runDirectory: string,
  relativePath: string,
  artifacts: RawArtifact[],
  options?: FetchHtmlOptions,
) {
  return fetchHtml(
    url,
    async ({ attempt, retrievedAt, httpStatus, html, error }) => {
      const metadata = {
        attempt,
        ...(httpStatus === undefined ? {} : { httpStatus }),
        error,
      };
      if (html !== undefined) {
        artifacts.push(
          await archiveHtml(
            runDirectory,
            relativePath + ".attempt-" + attempt + ".html",
            url,
            html,
            retrievedAt,
            "fetch_failed",
            metadata,
          ),
        );
      } else {
        artifacts.push(
          failedFetchArtifact(
            relativePath + ".attempt-" + attempt + ".fetch-failed",
            url,
            retrievedAt,
            metadata,
          ),
        );
      }
    },
    options,
  );
}

async function fetchHtml(
  url: string,
  onFailure: (failure: FetchFailure) => Promise<void>,
  options: FetchHtmlOptions = {},
) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const wait =
    options.wait ??
    ((milliseconds: number) =>
      new Promise<void>((resolve) => setTimeout(resolve, milliseconds)));

  let lastError: unknown;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    let httpStatus: number | undefined;
    let html: string | undefined;
    let retrievedAt = new Date().toISOString();
    try {
      const response = await fetchImpl(url, {
        signal: AbortSignal.timeout(30_000),
      });
      httpStatus = response.status;
      retrievedAt = new Date().toISOString();
      const declaredSize = Number(response.headers.get("content-length") ?? 0);
      if (declaredSize > MAX_HTML_BYTES) throw new Error(`${url} exceeds 5 MiB`);
      html = await response.text();
      retrievedAt = new Date().toISOString();
      if (Buffer.byteLength(html) > MAX_HTML_BYTES) {
        html = undefined;
        throw new Error(`${url} exceeds 5 MiB`);
      }
      if (/This page can't be displayed|incident ID:/i.test(html)) {
        throw new Error(url + " returned a platform protection page");
      }
      if (!response.ok)
        throw new Error(url + " returned HTTP " + response.status);
      return html;
    } catch (error) {
      lastError = error;
      retrievedAt = new Date().toISOString();
      await onFailure({
        attempt,
        retrievedAt,
        ...(httpStatus === undefined ? {} : { httpStatus }),
        ...(html === undefined ? {} : { html }),
        error:
          error instanceof Error ? error.message.slice(0, 500) : String(error),
      });
      if (attempt < 4) await wait(1500 * attempt);
    }
  }
  throw lastError;
}
