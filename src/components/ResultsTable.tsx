import {
  getLocale,
  getUiText,
  localizeCommitment,
  localizeDeployment,
} from "../i18n";
import type { Language } from "../i18n";
import type { ComparisonResult } from "../types";

interface ResultsTableProps {
  results: ComparisonResult[];
  onRemove: (id: string) => void;
  language: Language;
}

export function ResultsTable({
  results,
  onRemove,
  language,
}: ResultsTableProps) {
  const text = getUiText(language).results;
  const locale = getLocale(language);
  const currencyFormatter = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });

  return (
    <div className="table-scroll">
      <table className="results-table">
        <thead>
          <tr>
            <th>{text.model}</th>
            <th>{text.workload}</th>
            <th>{text.commitment}</th>
            <th>{text.requiredDeployed}</th>
            <th>{text.utilization}</th>
            <th>{text.paygoMonth}</th>
            <th>{text.ptuMonth}</th>
            <th>{text.savings}</th>
            <th aria-label={text.actions} />
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
                {result.rpm.toLocaleString(locale)} RPM
                <span className="table-subtext">
                  {result.inputTextTokens.toLocaleString(locale)}{" "}
                  {text.inputShort} /{" "}
                  {result.outputTokens.toLocaleString(locale)}{" "}
                  {text.outputShort}
                </span>
              </td>
              <td>
                {localizeCommitment(result.commitmentType, language)}
                <span className="table-subtext">
                  {localizeDeployment(result.deploymentType, language)}
                </span>
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
                  aria-label={`${text.remove} ${result.modelName}`}
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
