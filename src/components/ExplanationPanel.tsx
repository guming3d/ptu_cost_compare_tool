import type { ComparisonResult } from "../types";

interface ExplanationPanelProps {
  results: ComparisonResult[];
}

function formatResult(value: number | string): string {
  if (typeof value === "string") {
    return value;
  }
  return value.toLocaleString("en-US", {
    maximumFractionDigits: 4,
  });
}

export function ExplanationPanel({ results }: ExplanationPanelProps) {
  return (
    <div className="explanation-list">
      <p className="section-note">
        Each trace is captured when its comparison is added, so later input
        changes do not alter existing calculations.
      </p>
      {results.map((result, index) => (
        <details className="explanation-item" key={result.id} open={index === 0}>
          <summary>
            <span>
              <strong>{result.modelName}</strong>
              <small>
                {result.commitmentType} &middot; {result.rpm} RPM
              </small>
            </span>
            <span className="summary-chevron" aria-hidden="true">
              +
            </span>
          </summary>
          <div className="explanation-content">
            <div className="explanation-meta">
              <span>{result.explanation.provider}</span>
              <span>{result.explanation.deploymentType}</span>
              <span>{result.explanation.commitmentType}</span>
            </div>

            <details className="captured-inputs">
              <summary>Captured inputs and prices</summary>
              <dl>
                {Object.entries(result.explanation.inputs).map(([key, value]) => (
                  <div key={key}>
                    <dt>{key}</dt>
                    <dd>{String(value)}</dd>
                  </div>
                ))}
              </dl>
            </details>

            <ol className="step-list">
              {result.explanation.steps.map((step) => (
                <li key={step.output}>
                  <div className="step-heading">
                    <h4>{step.output}</h4>
                    <strong>
                      {formatResult(step.result)} {step.unit}
                    </strong>
                  </div>
                  <div className="formula-block">
                    <span>Formula</span>
                    <code>{step.formula}</code>
                  </div>
                  <div className="formula-block">
                    <span>Substitution</span>
                    <code>{step.substitution}</code>
                  </div>
                  {step.note ? <p className="step-note">{step.note}</p> : null}
                </li>
              ))}
            </ol>
          </div>
        </details>
      ))}
    </div>
  );
}
