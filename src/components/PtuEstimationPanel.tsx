import { useState } from "react";
import type katex from "katex";
import "katex/dist/katex.min.css";
import { TokenNormalizationPanel } from "./TokenNormalizationPanel";
import {
  getLocale,
  getUiText,
  localizeCommitment,
  localizeDeployment,
  localizeExplanationText,
} from "../i18n";
import type { Language } from "../i18n";
import type { ComparisonResult, ModelConfig } from "../types";

interface PtuEstimationPanelProps {
  model: ModelConfig;
  result: ComparisonResult | null;
  error: string | null;
  cacheWriteOverride: boolean;
  sourceUrl: string;
  comparisonCount: number;
  justAdded: boolean;
  onAddComparison: () => void;
  onOpenComparison: () => void;
  language: Language;
}

const PAYGO_ONLY_STEPS = new Set([
  "Monthly requests",
  "Monthly PayGO input cost",
  "Monthly PayGO image cost",
  "Monthly PayGO output cost",
  "PayGO cost",
  "PTU Cost Saving (%)",
]);

const PAYGO_ONLY_INPUT_KEYS = new Set([
  "inputPricePer1k",
  "cachedInputPricePer1k",
  "outputPricePer1k",
  "cacheWritePricePer1k",
  "imageInputPricePer1k",
  "paygoPricingScope",
  "paygoStatus",
  "paygoRetirementDate",
]);

const SIZING_FORMULAS: Record<string, string> = {
  "uncached tokens x input weight + cached tokens x cache weight + cache write tokens x write weight":
    String.raw`T_{\mathrm{input}}=T_{\mathrm{uncached}}w_{\mathrm{input}}+T_{\mathrm{cached}}w_{\mathrm{read}}+T_{\mathrm{write}}w_{\mathrm{write}}`,
  "input tokens x (1 - cache hit rate / 100)":
    String.raw`T_{\mathrm{input}}=T_{\mathrm{tokens}}\left(1-\frac{\mathrm{cache\ hit\ rate}}{100}\right)`,
  "RPM x (effective text input + image input x image-to-text factor + image output x image output-to-input ratio x image-to-text factor)":
    String.raw`\mathrm{TPM}=\mathrm{RPM}\left(T_{\mathrm{text}}+T_{\mathrm{image}}w_{\mathrm{image}}+T_{\mathrm{output}}w_{\mathrm{output}}w_{\mathrm{image}}\right)`,
  "RPM x (effective text input + image input) + output ratio x (RPM x output tokens)":
    String.raw`\mathrm{TPM}=\mathrm{RPM}\left(T_{\mathrm{text}}+T_{\mathrm{image}}+w_{\mathrm{output}}T_{\mathrm{output}}\right)`,
  "normalized TPM / input TPM per PTU":
    String.raw`\mathrm{PTUs}_{\mathrm{required}}=\frac{\mathrm{normalized\ TPM}}{\mathrm{input\ TPM\ per\ PTU}}`,
  "Required PTUs = user supplied PTU override":
    String.raw`\mathrm{PTUs}_{\mathrm{required}}=\mathrm{your\ PTU\ override}`,
  "Required PTUs = user supplied capacity estimate":
    String.raw`\mathrm{PTUs}_{\mathrm{required}}=\mathrm{your\ benchmarked\ estimate}`,
  "(input tokens + image estimate + output ratio x output tokens) x 4 x (RPM / 60) / characters per GSU":
    String.raw`\mathrm{GSUs}_{\mathrm{required}}=\frac{\left(T_{\mathrm{input}}+T_{\mathrm{image}}+w_{\mathrm{output}}T_{\mathrm{output}}\right)\cdot4\cdot\mathrm{RPM}}{60\cdot\mathrm{characters\ per\ GSU}}`,
  "max(minimum PTUs, ceil(required PTUs / scale increment) x scale increment)":
    String.raw`\mathrm{PTUs}_{\mathrm{deployed}}=\max\left(\mathrm{minimum},\left\lceil\frac{\mathrm{required}}{\mathrm{increment}}\right\rceil\cdot\mathrm{increment}\right)`,
  "required PTUs / deployed PTUs x 100":
    String.raw`\mathrm{utilization}=\frac{\mathrm{required}}{\mathrm{deployed}}\cdot100\%`,
  "deployed PTUs x PTU unit price x (1 - discount)":
    String.raw`\mathrm{monthly\ cost}=\mathrm{deployed\ PTUs}\cdot\mathrm{unit\ price}\cdot(1-\mathrm{discount})`,
  "total workload TPM / monthly PTU cost per minute / 1,000,000":
    String.raw`\mathrm{efficiency}=\frac{\mathrm{workload\ TPM}}{\mathrm{PTU\ cost\ per\ minute}\cdot1{,}000{,}000}`,
};

const EN_INPUT_LABELS: Record<string, string> = {
  inputTextTokens: "Input text tokens",
  inputImageTokens: "Input image tokens",
  outputTokens: "Output tokens",
  rpm: "Requests per minute (RPM)",
  cacheHitRate: "Cache hit rate (%)",
  contextMode: "Context pricing tier",
  cacheWriteTokens: "Cache write tokens",
  minimumPtus: "Minimum PTUs",
  scaleIncrement: "Scale increment",
  inputTpmPerPtu: "Input TPM per PTU",
  inputWeight: "Uncached input weight",
  cachedInputWeight: "Cache read weight",
  cacheWriteWeight: "Cache write weight",
  outputWeight: "Output token weight",
  imageInputWeight: "Image input weight",
  imageOutputWeight: "Image output weight",
  ptuPricePerUnit: "PTU unit price (USD)",
  ptuDiscount: "Commitment discount",
};

function formatInputLabel(key: string, language: Language): string {
  if (language === "en") {
    return EN_INPUT_LABELS[key] ?? key;
  }
  return localizeExplanationText(key, language);
}

function formatStepResult(value: number | string, locale: string): string {
  if (typeof value === "string") {
    return value;
  }
  return value.toLocaleString(locale, {
    maximumFractionDigits: 4,
  });
}

function formatInputParameter(
  value: number | string,
  locale: string,
  language: Language,
): string {
  if (typeof value === "number") {
    return value.toLocaleString(locale, { maximumFractionDigits: 6 });
  }
  return localizeExplanationText(value, language);
}

function substitutionToLatex(substitution: string): string | null {
  const operatorsOnly = substitution.replace(/\b(?:max|ceil)\b/g, "");
  if (!/^[\d.,%+\-*/=() x]+$/.test(operatorsOnly) || !/\d/.test(substitution)) {
    return null;
  }
  return substitution
    .replace(/,/g, "{,}")
    .replace(/\bmax\b/g, String.raw`\max`)
    .replace(/\bceil\b/g, String.raw`\operatorname{ceil}`)
    .replace(/\bx\b/g, String.raw`\times`)
    .replace(/\//g, String.raw`\div`)
    .replace(/%/g, String.raw`\%`);
}

function MathExpression({
  latex,
  label,
  renderer,
}: {
  latex: string;
  label: string;
  renderer: typeof katex;
}) {
  return (
    <div
      className="rendered-formula"
      role="math"
      aria-label={label}
      dangerouslySetInnerHTML={{
        __html: renderer.renderToString(latex, {
          displayMode: true,
          output: "html",
          throwOnError: false,
        }),
      }}
    />
  );
}

export function PtuEstimationPanel({
  model,
  result,
  error,
  cacheWriteOverride,
  sourceUrl,
  comparisonCount,
  justAdded,
  onAddComparison,
  onOpenComparison,
  language,
}: PtuEstimationPanelProps) {
  const ui = getUiText(language);
  const text = ui.estimation;
  const [mathRenderer, setMathRenderer] = useState<typeof katex | null>(null);
  const locale = getLocale(language);
  const currencyFormatter = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });

  const ptuSteps = result
    ? result.explanation.steps.filter(
        (step) => !PAYGO_ONLY_STEPS.has(step.output),
      )
    : [];
  const sizingInputs = result
    ? Object.entries(result.explanation.inputs).filter(
        ([key]) => !PAYGO_ONLY_INPUT_KEYS.has(key),
      )
    : [];

  const minimumPtus = result?.explanation.inputs.minimumPtus;
  const scaleIncrement = result?.explanation.inputs.scaleIncrement;
  const inputTpmPerPtu = result?.explanation.inputs.inputTpmPerPtu;
  const rawWorkloadTpm = result
    ? (result.inputTextTokens + result.inputImageTokens + result.outputTokens) *
      result.rpm
    : null;
  const utilizationPercent = result
    ? Math.min(100, Math.max(0, result.ptuUtilization))
    : 0;
  const requiredUnit = model.provider === "Google" ? "GSUs" : "PTUs";
  const stepDescriptions: Record<string, string> = {
    "Effective text input tokens": text.stepEffectiveInput,
    "Normalized TPM": text.stepNormalizedTpm,
    "Required PTU Num": text.stepRequiredPtus,
    "Deployable PTUs": text.stepDeployablePtus,
    "PTU Utilization": text.stepUtilization,
    "PTU cost": text.stepCost,
    "TPM per dollar (in millions)": text.stepEfficiency,
  };

  return (
    <div className="results-column estimation-column">
      <div className="estimation-toolbar">
        <div className="estimation-identity">
          <span className="live-pill">{text.liveBadge}</span>
          <strong>{model["model name"]}</strong>
          {result ? (
            <span className="estimation-meta-pill">
              {localizeDeployment(result.deploymentType, language)}
            </span>
          ) : null}
          {result?.contextMode ? (
            <span className="estimation-meta-pill">
              {result.contextMode === "long"
                ? ui.calculator.longContext
                : ui.calculator.shortContext}
            </span>
          ) : null}
        </div>
        <div className="estimation-actions">
          {justAdded ? (
            <span className="saved-pill" role="status">
              {text.savedFeedback}
            </span>
          ) : null}
          <button
            className="button button-secondary button-small"
            type="button"
            disabled={!result}
            onClick={onAddComparison}
          >
            + {text.saveToComparison}
          </button>
          <button
            className="button button-ghost button-small"
            type="button"
            onClick={onOpenComparison}
          >
            {text.compareWithPaygo}
            {comparisonCount > 0 ? (
              <span className="count-badge">{comparisonCount}</span>
            ) : null}
            <span aria-hidden="true">&rarr;</span>
          </button>
        </div>
      </div>

      <section
        className="estimation-summary-grid"
        aria-label={text.summaryAriaLabel}
        aria-live="polite"
      >
        <article className="hero-ptu-card" id="target-ptu-result" tabIndex={-1}>
          <span>{text.targetPtus}</span>
          <strong>
            {result ? result.deployedPtus.toLocaleString(locale) : "--"}{" "}
            <small>PTUs</small>
          </strong>
          <small>
            {minimumPtus !== undefined && scaleIncrement !== undefined
              ? `${text.minUnit} ${Number(minimumPtus).toLocaleString(locale)} · +${Number(scaleIncrement).toLocaleString(locale)} ${text.incrementUnit}`
              : localizeDeployment(model.provider, language)}
          </small>
        </article>

        <article>
          <span>{text.rawRequiredPtus}</span>
          <strong>
            {result
              ? result.requiredPtus.toLocaleString(locale, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })
              : "--"}{" "}
            <small>PTUs</small>
          </strong>
          <small>
            {text.utilization}:{" "}
            <strong>
              {result ? `${result.ptuUtilization.toFixed(2)}%` : "--"}
            </strong>
          </small>
          <div className="utilization-track" aria-hidden="true">
            <span style={{ width: `${utilizationPercent}%` }} />
          </div>
        </article>

        <article>
          <span>
            {result?.normalizedTpm !== undefined
              ? text.normalizedThroughput
              : text.workloadThroughput}
          </span>
          <strong>
            {result
              ? (result.normalizedTpm ?? rawWorkloadTpm ?? 0).toLocaleString(
                  locale,
                  { maximumFractionDigits: 0 },
                )
              : "--"}{" "}
            <small>TPM</small>
          </strong>
          <small>
            {typeof inputTpmPerPtu === "number"
              ? `${inputTpmPerPtu.toLocaleString(locale)} ${text.tpmPerPtu}`
              : result
                ? `${result.rpm.toLocaleString(locale)} RPM`
                : "--"}
          </small>
        </article>

        <article className="secondary-cost-card">
          <span>{text.monthlyPtuCost}</span>
          <strong>
            {result ? currencyFormatter.format(result.ptuCost) : "--"}
          </strong>
          <small>
            {result
              ? `${localizeCommitment(result.commitmentType, language)}${
                  result.ptuDiscount > 0
                    ? ` (-${Math.round(result.ptuDiscount * 100)}%)`
                    : ""
                }`
              : text.perMonth}
          </small>
        </article>
      </section>

      {error && !result ? (
        <div className="estimation-alert" role="alert">
          <strong>{text.unavailableTitle}</strong>
          <p>{localizeExplanationText(error, language)}</p>
        </div>
      ) : null}

      {result ? (
        <section className="content-card live-calculation-card">
          <div className="live-calculation-header">
            <div className="section-heading">
              <h2>{text.backendCalculationTitle}</h2>
              <p>{text.backendCalculationDescription}</p>
            </div>
            {!model["PTU input token weights"] ? (
              <a href={sourceUrl} target="_blank" rel="noreferrer">
                {text.sizingGuide}
              </a>
            ) : null}
          </div>

          <div className="sizing-flow" aria-label={text.flowAriaLabel}>
            <div className="sizing-stage">
              <span className="sizing-stage-number">01</span>
              <h3>{text.flowWorkload}</h3>
              <strong>{result.rpm.toLocaleString(locale)} RPM</strong>
              <p>{text.flowWorkloadDescription}</p>
            </div>
            <div className="sizing-stage">
              <span className="sizing-stage-number">02</span>
              <h3>{text.flowDemand}</h3>
              <strong>{formatStepResult(result.requiredPtus, locale)} {requiredUnit}</strong>
              <p>{text.flowDemandDescription}</p>
            </div>
            <div className="sizing-stage sizing-stage-target">
              <span className="sizing-stage-number">03</span>
              <h3>{text.flowDeployment}</h3>
              <strong>{result.deployedPtus.toLocaleString(locale)} PTUs</strong>
              <p>{text.flowDeploymentDescription}</p>
            </div>
          </div>
          <p className="sizing-flow-caption">{text.flowCaption}</p>

          <details
            className="sizing-details"
            onToggle={(event) => {
              if (event.currentTarget.open && !mathRenderer) {
                void import("katex").then((module) => setMathRenderer(() => module.default));
              }
            }}
          >
            <summary>{text.showCalculationSteps}</summary>
          <ol className="live-step-list">
            {ptuSteps.map((step, index) => {
              const isTargetStep = step.output === "Deployable PTUs";
              const stepNumber = String(index + 1).padStart(2, "0");
              const substitutionLatex = substitutionToLatex(step.substitution);
              return (
                <li
                  key={step.output}
                  className={isTargetStep ? "target-ptu-step" : undefined}
                >
                  <div className="step-heading">
                    <div className="live-step-title">
                      <span className="live-step-index" aria-hidden="true">
                        {stepNumber}
                      </span>
                      <h4>
                        {step.output === "Required PTU Num"
                          ? model.provider === "Google"
                            ? text.requiredGsuStepLabel
                            : text.requiredStepLabel
                          : localizeExplanationText(step.output, language)}
                      </h4>
                      {isTargetStep ? (
                        <span className="target-step-pill">
                          {text.targetStepBadge}
                        </span>
                      ) : null}
                    </div>
                    <strong>
                      {formatStepResult(step.result, locale)}{" "}
                      {localizeExplanationText(step.unit, language)}
                    </strong>
                  </div>
                  {stepDescriptions[step.output] ? (
                    <p className="live-step-description">
                      {stepDescriptions[step.output]}
                    </p>
                  ) : null}
                  <div className="formula-block">
                    <span>{text.formula}</span>
                    {mathRenderer && SIZING_FORMULAS[step.formula] ? (
                      <MathExpression
                        latex={SIZING_FORMULAS[step.formula]}
                        label={localizeExplanationText(step.formula, language)}
                        renderer={mathRenderer}
                      />
                    ) : (
                      <code>{localizeExplanationText(step.formula, language)}</code>
                    )}
                  </div>
                  <div className="formula-block">
                    <span>{text.substitution}</span>
                    {mathRenderer && substitutionLatex ? (
                      <MathExpression
                        latex={substitutionLatex}
                        label={localizeExplanationText(step.substitution, language)}
                        renderer={mathRenderer}
                      />
                    ) : (
                      <code>{localizeExplanationText(step.substitution, language)}</code>
                    )}
                  </div>
                  {step.note ? (
                    <p className="step-note">
                      {localizeExplanationText(step.note, language)}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ol>
          </details>

          <details className="captured-inputs live-sizing-inputs">
            <summary>{text.activeSizingParameters}</summary>
            <dl>
              {sizingInputs.map(([key, value]) => (
                <div key={key}>
                  <dt>{formatInputLabel(key, language)}</dt>
                  <dd>{formatInputParameter(value, locale, language)}</dd>
                </div>
              ))}
            </dl>
          </details>
        </section>
      ) : null}

      {model["PTU input token weights"] ? (
        <TokenNormalizationPanel
          model={model}
          result={result}
          cacheWriteOverride={cacheWriteOverride}
          sourceUrl={sourceUrl}
          language={language}
        />
      ) : null}
    </div>
  );
}
