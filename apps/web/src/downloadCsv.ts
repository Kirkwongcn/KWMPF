export function csvText(
  rows: Array<Array<string | number | undefined | null>>,
) {
  return (
    "\uFEFF" +
    rows
      .map((row) =>
        row
          .map((cell) => {
            let value = String(cell ?? "官方未提供");
            // Official names are untrusted spreadsheet input; prevent formula execution.
            if (typeof cell === "string" && /^[\s]*[=+\-@]/u.test(value))
              value = "'" + value;
            return '"' + value.replaceAll('"', '""') + '"';
          })
          .join(","),
      )
      .join("\r\n")
  );
}
export function downloadCsv(
  filename: string,
  rows: Array<Array<string | number | undefined | null>>,
) {
  const url = URL.createObjectURL(
    new Blob([csvText(rows)], { type: "text/csv;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
