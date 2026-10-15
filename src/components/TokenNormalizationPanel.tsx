import { getLocale, getUiText } from "../i18n";
import type { Language } from "../i18n";
import type { ComparisonResult, ModelConfig, NormalizedTokenBucket } from "../types";

interface TokenNormalizationPanelProps {
  model: ModelConfig;
  result: ComparisonResult | null;
  cacheWriteOverride: boolean;
  sourceUrl: string;
  language: Language;
}

export function TokenNormalizationPanel({
  model,
  result,
  cacheWriteOverride,
  sourceUrl,
  language,
}: TokenNormalizationPanelProps) {
  const ui = getUiText(language);
  const text = ui.normalization;
  const locale = getLocale(language);
  const format = (value: number) =>
    value.toLocaleString(locale, { maximumFractionDigits: 4 });
  const normalization = result?.tokenNormalization;
  const inputBucketOrder: NormalizedTokenBucket["category"][] = [
    "cached", "cacheWrite", "uncached",
  ];
  const inputBuckets = normalization?.buckets.filter((bucket) =>
    inputBucketOrder.includes(bucket.category),
  ).sort((left, right) =>
    inputBucketOrder.indexOf(left.category) - inputBucketOrder.indexOf(right.category),
  );
  const cachedBucket = inputBuckets?.find((bucket) => bucket.category === "cached");
  const cacheWriteBucket = inputBuckets?.find((bucket) => bucket.category === "cacheWrite");
  const inputPercentage = (tokens: number) =>
    result && result.inputTextTokens > 0 ? tokens / result.inputTextTokens * 100 : 0;
  const normalizedTpm = result?.normalizedTpm;
  const capacity = model["input TPM per PTU"];
  const tier = result?.contextMode === "long" ? model["long context"] : model;
  const prices: Partial<Record<NormalizedTokenBucket["category"], number>> = {
    uncached: tier?.["input token price per 1k"],
    cached: tier?.["input token price per 1k with cache hit"],
    cacheWrite: tier?.["cache write token price per 1k"],
    output: tier?.["output token price per 1k"],
  };
  const baselinePrice = model["input token price per 1k"];
  const hasCatalogOverride = normalization?.buckets.some((bucket) => {
    const price = prices[bucket.category];
    return price !== undefined &&
      Math.abs(bucket.weight - price / baselinePrice) > 1e-9;
  });
  const isRegional = result?.deploymentType === "Regional";
  const minimum = isRegional
    ? model["regional PTU minimum deployment unit"]
    : model["PTU minumum deployment unit"];
  const increment = isRegional
    ? model["regional PTU scale increment"]
    : model["PTU scale increment"];

  return (
    <section className="normalization-panel" aria-label={text.title}>
      <header className="normalization-heading">
        <div>
          <h2>{text.title}</h2>
          <p>{text.description}</p>
        </div>
        <a href={sourceUrl} target="_blank" rel="noreferrer">{text.source}</a>
      </header>

      {result && normalization && inputBuckets && cachedBucket && cacheWriteBucket &&
        normalizedTpm !== undefined && capacity !== undefined &&
        minimum !== undefined && increment !== undefined ? (
        <>
          <div className="normalization-context">
            <strong>{model["model name"]}</strong>
            <span>
              {result.contextMode === "long" ? ui.calculator.longContext : ui.calculator.shortContext}
            </span>
          </div>
          <h3>{text.inputSplit}</h3>
          <figure className="normalization-input-diagram">
            <figcaption className="normalization-input-summary">
              <strong>{text.requestInput}</strong>
              <span>{text.inputTokens}: <strong>{format(result.inputTextTokens)}</strong></span>
            </figcaption>
            <div className="normalization-prefix-summary">
              <span>{text.cachedPrefix}</span>
              <span>{text.cacheHitRate}: <strong>{format(result.cacheHitRate)}%</strong></span>
            </div>
            <div className="normalization-split-track" aria-hidden="true">
              <div className="normalization-split-bar">
                {inputBuckets.filter((bucket) => bucket.tokens > 0).map((bucket) => (
                  <span
                    key={bucket.category}
                    data-category={bucket.category}
                    className={`normalization-split-segment normalization-color-${bucket.category}`}
                    style={{ width: `${inputPercentage(bucket.tokens)}%` }}
                  >
                    {inputPercentage(bucket.tokens) >= 25 ? (
                      <strong className="normalization-segment-count">{format(bucket.tokens)}</strong>
                    ) : null}
                  </span>
                ))}
              </div>
              {cachedBucket.tokens > 0 && cachedBucket.tokens < result.inputTextTokens ? (
                <span
                  className="normalization-split-boundary normalization-prefix-boundary"
                  style={{ left: `${inputPercentage(cachedBucket.tokens)}%` }}
                >
                  <span className="normalization-boundary-handle" />
                </span>
              ) : null}
              {cacheWriteBucket.tokens > 0 &&
                cachedBucket.tokens + cacheWriteBucket.tokens < result.inputTextTokens ? (
                  <span
                    className="normalization-split-boundary"
                    style={{
                      left: `${inputPercentage(cachedBucket.tokens + cacheWriteBucket.tokens)}%`,
                    }}
                  >
                    <span className="normalization-boundary-handle" />
                  </span>
                ) : null}
            </div>
            <div className="normalization-input-axis" aria-hidden="true">
              <span>{text.inputStart}</span>
              <span>{text.inputEnd}</span>
            </div>
            <dl className="normalization-split-legend">
              {inputBuckets.map((bucket) => (
                <div key={bucket.category}>
                  <dt>
                    <span className={`normalization-swatch normalization-color-${bucket.category}`} />
                    {text.buckets[bucket.category]}
                  </dt>
                  <dd>{format(bucket.tokens)}</dd>
                </div>
              ))}
            </dl>
            <p className="normalization-note">{text.prefixOrder}</p>
          </figure>
          <p className="normalization-note">
            {format(result.inputTextTokens)} = {inputBuckets.map((bucket) => format(bucket.tokens)).join(" + ")}.
            {" "}{text.noDoubleCounting}
          </p>
          <p className="normalization-note">
            {text.buckets.cached}: {format(result.inputTextTokens)} x {format(result.cacheHitRate)}% ={" "}
            {format(cachedBucket.tokens)}.
          </p>
          <p className="normalization-note">
            {text.buckets.cacheWrite}:{" "}
            {cacheWriteOverride
              ? `${format(cacheWriteBucket.tokens)}. ${text.manualWrites}`
              : `${format(result.inputTextTokens)} x (100% - ${format(result.cacheHitRate)}%) = ${format(cacheWriteBucket.tokens)}. ${text.automaticWrites}`}
          </p>

          <h3>{text.conversion}</h3>
          <p className="normalization-note">
            {text.baseline}{" "}
            {new Intl.NumberFormat(locale, {
              style: "currency", currency: "USD", maximumFractionDigits: 2,
            }).format(baselinePrice * 1000)} {text.perMillion}.
            {" "}{text.longContextBaseline}
          </p>
          {hasCatalogOverride ? (
            <p className="normalization-warning" role="status">{text.catalogOverride}</p>
          ) : null}
          <div className="normalization-table-scroll">
            <table className="normalization-table">
              <thead>
                <tr>
                  <th scope="col">{text.category}</th>
                  <th scope="col">{text.tokens}</th>
                  <th scope="col">{text.weight}</th>
                  <th scope="col">{text.normalized}</th>
                </tr>
              </thead>
              <tbody>
                {normalization.buckets.map((bucket) => (
                  <tr key={bucket.category} data-category={bucket.category}>
                    <th scope="row">
                      <span className={`normalization-swatch normalization-color-${bucket.category}`} />
                      {text.buckets[bucket.category]}
                    </th>
                    <td>{format(bucket.tokens)}</td>
                    <td>x {format(bucket.weight)} <small>({format(bucket.weight * 100)}%)</small></td>
                    <td>
                      <strong>= {format(bucket.normalizedTokens)}</strong>
                      <div className="normalization-contribution" aria-hidden="true">
                        <span
                          className={`normalization-color-${bucket.category}`}
                          style={{
                            width: `${normalization.normalizedTokensPerRequest > 0
                              ? bucket.normalizedTokens / normalization.normalizedTokensPerRequest * 100 : 0}%`,
                          }}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ol className="normalization-flow">
            <li>
              <span>{text.sum}</span>
              <strong>{format(normalization.normalizedTokensPerRequest)}</strong>
              <small>{text.normalizedPerRequest}</small>
              <code>{normalization.buckets.map((bucket) => format(bucket.normalizedTokens)).join(" + ")}</code>
            </li>
            <li>
              <span>{text.multiplyRpm}</span>
              <strong>{format(normalizedTpm)}</strong>
              <small>{text.normalizedTpm}</small>
              <code>{format(normalization.normalizedTokensPerRequest)} x {format(result.rpm)}</code>
            </li>
            <li>
              <span>{text.divideCapacity}</span>
              <strong>{format(result.requiredPtus)}</strong>
              <small>{text.rawPtus}</small>
              <code>{format(normalizedTpm)} / {format(capacity)}</code>
            </li>
            <li>
              <span>{text.roundDeployment}</span>
              <strong>{format(result.deployedPtus)}</strong>
              <small>{text.deployedPtus}</small>
              <code>max({format(minimum)}, ceil({format(result.requiredPtus)} / {format(increment)}) x {format(increment)})</code>
            </li>
          </ol>
          <p className="normalization-note">
            {text.minimumIncrement}: {format(minimum)} / {format(increment)} PTUs.
          </p>
        </>
      ) : (
        <p className="normalization-note" role="status">{text.unavailable}</p>
      )}
    </section>
  );
}
