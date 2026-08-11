import type { ComparisonResult } from "../types";

interface MetricBarsProps {
  title: string;
  description: string;
  results: ComparisonResult[];
  value: (result: ComparisonResult) => number;
  format: (value: number) => string;
}

function shortModelName(modelName: string): string {
  return modelName
    .replace(/^azure openai /i, "")
    .replace(/^fireworks /i, "")
    .replace(/^google /i, "");
}

export function MetricBars({
  title,
  description,
  results,
  value,
  format,
}: MetricBarsProps) {
  const maximum = Math.max(...results.map(value), 0);

  return (
    <section className="metric-card">
      <div className="section-heading compact">
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
      <div className="metric-bars">
        {results.map((result) => {
          const metric = value(result);
          const width = maximum === 0 ? 0 : (metric / maximum) * 100;

          return (
            <div className="metric-row" key={result.id}>
              <div className="metric-label">
                <span title={result.modelName}>
                  {shortModelName(result.modelName)}
                </span>
                <strong>{format(metric)}</strong>
              </div>
              <div className="metric-track">
                <span style={{ width: `${Math.max(width, metric > 0 ? 2 : 0)}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
