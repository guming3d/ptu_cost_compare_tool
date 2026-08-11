import type { ComparisonResult } from "../types";

function escapeHtml(value: string | number): string {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function exportResultsToExcel(results: ComparisonResult[]): void {
  const headers = [
    "Model Name",
    "Provider",
    "Input Token Number",
    "Input Image Tokens",
    "Cache Hit Rate (%)",
    "Output Token Number",
    "RPM",
    "Commitment Type",
    "Deployment Type",
    "Required PTU Num",
    "Deployed PTUs",
    "PTU Utilization (%)",
    "PayGO cost",
    "PTU cost",
    "TPM per dollar (in millions)",
    "PTU Cost Saving (%)",
  ];

  const rows = results.map((result) => [
    result.modelName,
    result.provider,
    result.inputTextTokens,
    result.inputImageTokens,
    result.cacheHitRate,
    result.outputTokens,
    result.rpm,
    result.commitmentType,
    result.deploymentType,
    result.requiredPtus,
    result.deployedPtus,
    result.ptuUtilization,
    result.paygoCost,
    result.ptuCost,
    result.tpmPerDollar,
    result.costSavingPercentage,
  ]);

  const table = `
    <table>
      <thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead>
      <tbody>
        ${rows
          .map(
            (row) =>
              `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`,
          )
          .join("")}
      </tbody>
    </table>
  `;
  const workbook = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:x="urn:schemas-microsoft-com:office:excel">
      <head><meta charset="UTF-8"></head>
      <body>${table}</body>
    </html>
  `;
  const blob = new Blob([workbook], {
    type: "application/vnd.ms-excel;charset=utf-8",
  });
  const link = document.createElement("a");
  const timestamp = new Date().toISOString().slice(0, 16).replaceAll(":", "-");

  link.href = URL.createObjectURL(blob);
  link.download = `ptu-cost-compare-${timestamp}.xls`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(link.href);
}
