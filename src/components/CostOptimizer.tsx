import {
  getLocale,
  getUiText,
  localizeCommitment,
  localizeDeployment,
} from "../i18n";
import type { Language } from "../i18n";
import type {
  CostCurvePoint,
  CostOptimization,
  PtuConfigurationCurve,
} from "../types";

interface CostOptimizerProps {
  optimization: CostOptimization;
  currentRpm: number;
  language: Language;
}

const CHART_WIDTH = 960;
const CHART_HEIGHT = 360;
const CHART_MARGIN = { top: 24, right: 24, bottom: 54, left: 82 };
const CONFIGURATION_COLORS = ["#1677c8", "#7047a8", "#bd641d", "#168463", "#b73960", "#536478"];
const CONFIGURATION_DASHES = [undefined, "9 5", "2 4", "10 4 2 4", "5 3", "12 3 2 3"];
const LEGEND_STYLES = ["solid", "dashed", "dotted", "double", "dashed", "dotted"] as const;

function linePath(
  points: CostCurvePoint[],
  value: (point: CostCurvePoint) => number,
  x: (rpm: number) => number,
  y: (cost: number) => number,
): string {
  return points
    .map((point, index) => {
      const command = index === 0 ? "M" : "L";
      return `${command} ${x(point.rpm)} ${y(value(point))}`;
    })
    .join(" ");
}

function stepPath(
  points: CostCurvePoint[],
  x: (rpm: number) => number,
  y: (cost: number) => number,
): string {
  if (points.length === 0) {
    return "";
  }

  return points.slice(1).reduce((path, point, index) => {
    const previous = points[index];
    return `${path} L ${x(point.rpm)} ${y(previous.ptuCost)} L ${x(point.rpm)} ${y(point.ptuCost)}`;
  }, `M ${x(points[0].rpm)} ${y(points[0].ptuCost)}`);
}

function configurationLabel(
  configuration: PtuConfigurationCurve,
  language: Language,
): string {
  return `${localizeCommitment(configuration.commitmentType, language)} · ${localizeDeployment(configuration.deploymentType, language)}`;
}

export function CostOptimizer({
  optimization,
  currentRpm,
  language,
}: CostOptimizerProps) {
  const text = getUiText(language).optimizer;
  const locale = getLocale(language);
  const best = optimization.bestConfiguration;
  const plotWidth = CHART_WIDTH - CHART_MARGIN.left - CHART_MARGIN.right;
  const plotHeight = CHART_HEIGHT - CHART_MARGIN.top - CHART_MARGIN.bottom;
  const allCosts = optimization.configurations.flatMap((configuration) =>
    configuration.points.flatMap((point) => [point.paygoCost, point.ptuCost]),
  );
  const maximumCost = Math.max(...allCosts.filter((cost): cost is number => cost !== null), 1);
  const x = (rpm: number) =>
    CHART_MARGIN.left + (rpm / optimization.maxRpm) * plotWidth;
  const y = (cost: number) =>
    CHART_MARGIN.top + plotHeight - (cost / maximumCost) * plotHeight;
  const currency = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
  const compactCurrency = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  });
  const yTicks = Array.from({ length: 5 }, (_, index) => index / 4);
  const xTicks = Array.from({ length: 5 }, (_, index) => index / 4);
  const paygoPoints = best.points;
  const paygoCurves = optimization.configurations.filter((configuration, index, all) =>
    all.findIndex((other) =>
      other.current.paygoCost === configuration.current.paygoCost &&
      other.paygoPricingScope === configuration.paygoPricingScope,
    ) === index,
  );
  const paygoLabel = (configuration: PtuConfigurationCurve) =>
    `PayGO${configuration.paygoPricingScope ? ` · ${configuration.paygoPricingScope}` : ""}`;
  const formatCurrency = (cost: number | null) => cost === null ? "N/A" : currency.format(cost);
  const tablePointIndexes = Array.from(
    new Set([
      ...Array.from(
        { length: Math.min(41, paygoPoints.length) },
        (_, index) =>
          Math.round(
            (index * (paygoPoints.length - 1)) /
              Math.max(Math.min(40, paygoPoints.length - 1), 1),
          ),
      ),
      paygoPoints.findIndex((point) => point.rpm === currentRpm),
      ...optimization.configurations.map((configuration) =>
        configuration.breakEvenRpm === undefined
          ? -1
          : paygoPoints.findIndex(
              (point) => point.rpm === configuration.breakEvenRpm,
            ),
      ),
    ]),
  )
    .filter((index) => index >= 0)
    .sort((left, right) => left - right);
  const currentMarkerX = x(Math.min(currentRpm, optimization.maxRpm));
  const savingsAmount = Math.abs(best.current.savings ?? 0);

  return (
    <section className="content-card optimizer-card" aria-label={text.ariaLabel}>
      <div className="optimizer-heading">
        <div className="section-heading">
          <h2>{text.title}</h2>
          <p>{text.description}</p>
        </div>
        <div
          className={
            best.current.savings !== null && best.current.savings >= 0
              ? "recommendation positive"
              : "recommendation"
          }
        >
          <span>{text.bestConfiguration}</span>
          <strong>{configurationLabel(best, language)}</strong>
          <p>
            {best.current.savings === null
              ? text.paygoUnavailable
              : <>
                  {best.current.savings >= 0
                    ? `${text.saves} ${currency.format(savingsAmount)} (${best.current.savingsPercentage?.toFixed(1)}%)`
                    : `${text.paygoLowerBy} ${currency.format(savingsAmount)}`}{" "}
                  {text.perMonthAt} {currentRpm.toLocaleString(locale)} RPM.
                </>}
          </p>
          <small>
            {best.breakEvenRpm !== undefined
              ? `${text.breakEven}: ${best.breakEvenRpm.toLocaleString(locale, {
                  maximumFractionDigits: 1,
                })} RPM`
              : best.current.paygoCost === null ? "N/A" : text.breakEvenNotReached}
          </small>
        </div>
      </div>

      <div className="cost-chart-scroll">
        <svg
          className="cost-chart"
          viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
          role="img"
          aria-label={text.chartAriaLabel}
        >
          <title>{text.chartAriaLabel}</title>
          {yTicks.map((tick) => {
            const tickY = CHART_MARGIN.top + plotHeight - tick * plotHeight;
            return (
              <g key={`y-${tick}`}>
                <line
                  className="chart-grid-line"
                  x1={CHART_MARGIN.left}
                  x2={CHART_WIDTH - CHART_MARGIN.right}
                  y1={tickY}
                  y2={tickY}
                />
                <text
                  className="chart-axis-label"
                  x={CHART_MARGIN.left - 12}
                  y={tickY + 4}
                  textAnchor="end"
                >
                  {compactCurrency.format(maximumCost * tick)}
                </text>
              </g>
            );
          })}
          {xTicks.map((tick) => {
            const tickX = CHART_MARGIN.left + tick * plotWidth;
            return (
              <text
                className="chart-axis-label"
                key={`x-${tick}`}
                x={tickX}
                y={CHART_HEIGHT - 24}
                textAnchor="middle"
              >
                {(optimization.maxRpm * tick).toLocaleString(locale, {
                  maximumFractionDigits: 0,
                })}
              </text>
            );
          })}
          <text
            className="chart-axis-title"
            x={CHART_MARGIN.left + plotWidth / 2}
            y={CHART_HEIGHT - 3}
            textAnchor="middle"
          >
            {text.rpmAxis}
          </text>
          <line
            className="current-rpm-line"
            x1={currentMarkerX}
            x2={currentMarkerX}
            y1={CHART_MARGIN.top}
            y2={CHART_MARGIN.top + plotHeight}
          />
          <text
            className="current-rpm-label"
            x={currentMarkerX}
            y={CHART_MARGIN.top - 8}
            textAnchor={currentMarkerX > CHART_WIDTH - 110 ? "end" : "middle"}
          >
            {text.currentTraffic}
          </text>
          {paygoCurves.filter((configuration) => configuration.current.paygoCost !== null).map((configuration, index) => (
            <path
              key={`paygo-${configuration.id}`}
              className="paygo-line"
              strokeDasharray={CONFIGURATION_DASHES[index % CONFIGURATION_DASHES.length]}
              d={linePath(configuration.points, (point) => point.paygoCost!, x, y)}
            />
          ))}
          {optimization.configurations.map((configuration, index) => (
            <path
              className="ptu-line"
              d={stepPath(configuration.points, x, y)}
              key={configuration.id}
              stroke={CONFIGURATION_COLORS[index % CONFIGURATION_COLORS.length]}
              strokeDasharray={CONFIGURATION_DASHES[index % CONFIGURATION_DASHES.length]}
            />
          ))}
        </svg>
      </div>

      <div className="chart-legend" aria-label={text.legend}>
        {paygoCurves.map((configuration, index) => (
          <div key={`paygo-${configuration.id}`}>
            <span className="legend-line paygo" style={{ borderTopStyle: LEGEND_STYLES[index % LEGEND_STYLES.length] }} aria-hidden="true" />
            <strong>{paygoLabel(configuration)}</strong>
            <small>{formatCurrency(configuration.current.paygoCost)}</small>
          </div>
        ))}
        {optimization.configurations.map((configuration, index) => (
          <div key={configuration.id}>
            <span
              className="legend-line"
              style={{
                borderColor: CONFIGURATION_COLORS[index % CONFIGURATION_COLORS.length],
                borderTopStyle: LEGEND_STYLES[index % LEGEND_STYLES.length],
              }}
              aria-hidden="true"
            />
            <strong>{configurationLabel(configuration, language)}</strong>
            <small>
              {currency.format(configuration.current.ptuCost)} ·{" "}
              {configuration.current.deployedPtus.toLocaleString(locale)} PTUs
            </small>
          </div>
        ))}
      </div>
      <details className="cost-data">
        <summary>{text.dataTable}</summary>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>{text.rpm}</th>
                {paygoCurves.map((configuration) => (
                  <th key={`paygo-${configuration.id}`}>{paygoLabel(configuration)}</th>
                ))}
                {optimization.configurations.map((configuration) => (
                  <th key={configuration.id}>
                    {configurationLabel(configuration, language)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tablePointIndexes.map((pointIndex) => {
                const point = paygoPoints[pointIndex];
                return (
                  <tr key={point.rpm}>
                    <td>
                      {point.rpm.toLocaleString(locale, {
                        maximumFractionDigits: 1,
                      })}
                    </td>
                    {paygoCurves.map((configuration) => (
                      <td key={`paygo-${configuration.id}`}>{formatCurrency(configuration.points[pointIndex].paygoCost)}</td>
                    ))}
                    {optimization.configurations.map((configuration) => (
                      <td key={configuration.id}>
                        {currency.format(
                          configuration.points[pointIndex].ptuCost,
                        )}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </details>
      <p className="optimizer-note">{text.assumptions}</p>
    </section>
  );
}
