import {
  getLocale,
  getUiText,
  localizeCommitment,
  localizeDeployment,
  localizeExplanationText,
} from "../i18n";
import type { Language } from "../i18n";
import type { ComparisonResult } from "../types";

interface ExplanationPanelProps {
  results: ComparisonResult[];
  language: Language;
}

function formatResult(value: number | string, locale: string): string {
  if (typeof value === "string") {
    return value;
  }
  return value.toLocaleString(locale, {
    maximumFractionDigits: 4,
  });
}

export function ExplanationPanel({
  results,
  language,
}: ExplanationPanelProps) {
  const text = getUiText(language).explanation;
  const locale = getLocale(language);

  return (
    <div className="explanation-list">
      <p className="section-note">{text.note}</p>
      {results.map((result, index) => (
        <details className="explanation-item" key={result.id} open={index === 0}>
          <summary>
            <span>
              <strong>{result.modelName}</strong>
              <small>
                {localizeCommitment(result.commitmentType, language)} &middot;{" "}
                {result.rpm.toLocaleString(locale)} RPM
              </small>
            </span>
            <span className="summary-chevron" aria-hidden="true">
              +
            </span>
          </summary>
          <div className="explanation-content">
            <div className="explanation-meta">
              <span>{result.explanation.provider}</span>
              <span>
                {localizeDeployment(
                  result.explanation.deploymentType,
                  language,
                )}
              </span>
              <span>
                {localizeCommitment(
                  result.explanation.commitmentType,
                  language,
                )}
              </span>
            </div>

            <details className="captured-inputs">
              <summary>{text.capturedInputs}</summary>
              <dl>
                {Object.entries(result.explanation.inputs).map(([key, value]) => (
                  <div key={key}>
                    <dt>{localizeExplanationText(key, language)}</dt>
                    <dd>{String(value)}</dd>
                  </div>
                ))}
              </dl>
            </details>

            <ol className="step-list">
              {result.explanation.steps.map((step) => (
                <li key={step.output}>
                  <div className="step-heading">
                    <h4>
                      {localizeExplanationText(step.output, language)}
                    </h4>
                    <strong>
                      {formatResult(step.result, locale)}{" "}
                      {localizeExplanationText(step.unit, language)}
                    </strong>
                  </div>
                  <div className="formula-block">
                    <span>{text.formula}</span>
                    <code>
                      {localizeExplanationText(step.formula, language)}
                    </code>
                  </div>
                  <div className="formula-block">
                    <span>{text.substitution}</span>
                    <code>
                      {localizeExplanationText(step.substitution, language)}
                    </code>
                  </div>
                  {step.note ? (
                    <p className="step-note">
                      {localizeExplanationText(step.note, language)}
                    </p>
                  ) : null}
                </li>
              ))}
            </ol>
          </div>
        </details>
      ))}
    </div>
  );
}
