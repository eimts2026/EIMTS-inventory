import Papa from "papaparse";

export function download(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function exportCsv(
  filename: string,
  rows: Record<string, string | number>[],
) {
  const safeRows = rows.map((row) =>
    Object.fromEntries(
      Object.entries(row).map(([key, value]) => [
        key,
        typeof value === "string" && /^[=+\-@\t\r]/.test(value)
          ? `'${value}`
          : value,
      ]),
    ),
  );
  download(
    filename,
    "\uFEFF" + Papa.unparse(safeRows),
    "text/csv;charset=utf-8;",
  );
}
