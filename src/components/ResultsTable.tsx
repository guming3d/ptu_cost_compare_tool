import type { ComparisonResult } from "../types";

interface ResultsTableProps {
  results: ComparisonResult[];
  onRemove: (id: string) => void;
}

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

export function ResultsTable({ results, onRemove }: ResultsTableProps) {
  return (
    <div className="table-scroll">
      <table className="results-table">
        <thead>
          <tr>
            <th>Model</th>
            <th>Workload</th>
            <th>Commitment</th>
            <th>Required / deployed</th>
            <th>Utilization</th>
            <th>PayGO / month</th>
            <th>PTU / month</th>
            <th>Savings</th>
            <th aria-label="Actions" />
          </tr>
        </thead>
        <tbody>
          {results.map((result) => (
            <tr key={result.id}>
              <td>
                <strong className="table-model">{result.modelName}</strong>
                <span className="table-subtext">{result.provider}</span>
              </td>
              <td>
                {result.rpm.toLocaleString("en-US")} RPM
                <span className="table-subtext">
                  {result.inputTextTokens.toLocaleString("en-US")} in /{" "}
                  {result.outputTokens.toLocaleString("en-US")} out
                </span>
              </td>
              <td>
                {result.commitmentType}
                <span className="table-subtext">{result.deploymentType}</span>
              </td>
              <td>
                {result.requiredPtus.toFixed(2)} / {result.deployedPtus}
              </td>
              <td>{result.ptuUtilization.toFixed(2)}%</td>
              <td>{currencyFormatter.format(result.paygoCost)}</td>
              <td>{currencyFormatter.format(result.ptuCost)}</td>
              <td>
                <span
                  className={
                    result.costSavingPercentage >= 0
                      ? "saving-badge positive"
                      : "saving-badge negative"
                  }
                >
                  {result.costSavingPercentage.toFixed(2)}%
                </span>
              </td>
              <td>
                <button
                  className="icon-button"
                  type="button"
                  onClick={() => onRemove(result.id)}
                  aria-label={`Remove ${result.modelName}`}
                >
                  &times;
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
