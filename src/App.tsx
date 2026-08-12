import { useEffect, useMemo, useState } from "react";
import { CalculatorForm } from "./components/CalculatorForm";
import { CatalogEditor } from "./components/CatalogEditor";
import { ExplanationPanel } from "./components/ExplanationPanel";
import { MetricBars } from "./components/MetricBars";
import { ReferenceInfo } from "./components/ReferenceInfo";
import { ResultsTable } from "./components/ResultsTable";
import { readStoredCatalog } from "./data/catalog";
import {
  DEFAULT_LANGUAGE,
  getLocale,
  getUiText,
  languageOptions,
} from "./i18n";
import { calculateScenario } from "./lib/calculations";
import { exportResultsToExcel } from "./lib/exportExcel";
import type { Language } from "./i18n";
import type {
  CatalogDocument,
  CommitmentType,
  ComparisonResult,
  DeploymentType,
  WorkloadImage,
} from "./types";

type ActiveTab = "comparison" | "explanations";

function App() {
  const [language, setLanguage] = useState<Language>(DEFAULT_LANGUAGE);
  const [catalog, setCatalog] = useState<CatalogDocument>(readStoredCatalog);
  const [selectedModelName, setSelectedModelName] = useState(
    () => catalog.models[0]["model name"],
  );
  const [inputTextTokens, setInputTextTokens] = useState(3500);
  const [outputTokens, setOutputTokens] = useState(300);
  const [rpm, setRpm] = useState(60);
  const [cacheHitRate, setCacheHitRate] = useState(0);
  const [images, setImages] = useState<WorkloadImage[]>([]);
  const [deploymentType, setDeploymentType] =
    useState<DeploymentType>("Global / Data Zone");
  const [commitmentType, setCommitmentType] =
    useState<CommitmentType>("Monthly");
  const [manualRequiredPtus, setManualRequiredPtus] = useState(
    catalog.models[0]["PTU minumum deployment unit"],
  );
  const [results, setResults] = useState<ComparisonResult[]>([]);
  const [activeTab, setActiveTab] = useState<ActiveTab>("comparison");
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const text = getUiText(language);
  const locale = getLocale(language);
  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat(locale, {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 2,
      }),
    [locale],
  );

  const selectedModel =
    catalog.models.find(
      (model) => model["model name"] === selectedModelName,
    ) ?? catalog.models[0];

  useEffect(() => {
    const selectedStillExists = catalog.models.some(
      (model) => model["model name"] === selectedModelName,
    );
    if (!selectedStillExists) {
      setSelectedModelName(catalog.models[0]["model name"]);
    }
  }, [catalog, selectedModelName]);

  useEffect(() => {
    setManualRequiredPtus(selectedModel["PTU minumum deployment unit"]);
    if (selectedModel.provider !== "Azure OpenAI") {
      setDeploymentType("Global / Data Zone");
    }
  }, [selectedModel]);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const scenarioInput = useMemo(
    () => ({
      model: selectedModel,
      inputTextTokens,
      outputTokens,
      rpm,
      cacheHitRate,
      images,
      commitmentType,
      deploymentType,
      manualRequiredPtus,
    }),
    [
      cacheHitRate,
      commitmentType,
      deploymentType,
      images,
      inputTextTokens,
      manualRequiredPtus,
      outputTokens,
      rpm,
      selectedModel,
    ],
  );

  const preview = useMemo(() => {
    try {
      const result = calculateScenario(scenarioInput);
      return {
        requiredPtus: result.requiredPtus,
        deployedPtus: result.deployedPtus,
        normalizedTpm: result.normalizedTpm,
        paygoCost: result.paygoCost,
        ptuCost: result.ptuCost,
        savings: result.costSavingPercentage,
      };
    } catch {
      return null;
    }
  }, [scenarioInput]);

  const addComparison = () => {
    try {
      const result = calculateScenario(scenarioInput);
      setResults((current) => [...current, result]);
      setSubmissionError(null);
      setActiveTab("comparison");
    } catch (error) {
      setSubmissionError(
        error instanceof Error ? error.message : text.errors.calculate,
      );
    }
  };

  const updateCatalog = (nextCatalog: CatalogDocument) => {
    setCatalog(nextCatalog);
    setResults([]);
    setSubmissionError(null);
  };

  return (
    <div className="app-shell">
      <header className="site-header">
        <a
          className="wordmark"
          href="#top"
          aria-label={text.header.homeLabel}
        >
          Azure Foundry PTU Cost Planner
        </a>
        <div className="header-actions">
          <nav aria-label={text.header.navigationLabel}>
            <a href="#calculator">{text.header.calculator}</a>
            <a
              href={catalog.metadata["ptu sizing source"]}
              target="_blank"
              rel="noreferrer"
            >
              {text.header.sizingGuide}
            </a>
          </nav>
          <label className="language-select">
            <span>{text.header.language}</span>
            <select
              value={language}
              onChange={(event) =>
                setLanguage(event.target.value as Language)
              }
            >
              {languageOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </header>

      <main id="top">
        <section className="hero">
          <div>
            <h1>{text.hero.title}</h1>
            <p>{text.hero.description}</p>
          </div>
          <dl className="catalog-summary">
            <div>
              <dt>{text.hero.models}</dt>
              <dd>{catalog.models.length}</dd>
            </div>
            <div>
              <dt>{text.hero.catalogVerified}</dt>
              <dd>{catalog.metadata["verified date"]}</dd>
            </div>
            <div>
              <dt>{text.hero.currency}</dt>
              <dd>{catalog.metadata.currency}</dd>
            </div>
          </dl>
        </section>

        <section className="calculator-layout" id="calculator">
          <CalculatorForm
            models={catalog.models}
            selectedModelName={selectedModel["model name"]}
            onModelChange={setSelectedModelName}
            selectedModel={selectedModel}
            inputTextTokens={inputTextTokens}
            onInputTextTokensChange={setInputTextTokens}
            cacheHitRate={cacheHitRate}
            onCacheHitRateChange={setCacheHitRate}
            outputTokens={outputTokens}
            onOutputTokensChange={setOutputTokens}
            rpm={rpm}
            onRpmChange={setRpm}
            images={images}
            onImagesChange={setImages}
            deploymentType={deploymentType}
            onDeploymentTypeChange={setDeploymentType}
            commitmentType={commitmentType}
            onCommitmentTypeChange={setCommitmentType}
            manualRequiredPtus={manualRequiredPtus}
            onManualRequiredPtusChange={setManualRequiredPtus}
            preview={preview}
            error={submissionError}
            onAdd={addComparison}
            onClear={() => setResults([])}
            hasResults={results.length > 0}
            language={language}
          />

          <div className="results-column">
            <section
              className="summary-grid"
              aria-label={text.summary.ariaLabel}
            >
              <article>
                <span>{text.summary.paygoEstimate}</span>
                <strong>
                  {preview ? currencyFormatter.format(preview.paygoCost) : "--"}
                </strong>
                <small>{text.summary.perMonth}</small>
              </article>
              <article>
                <span>{text.summary.ptuEstimate}</span>
                <strong>
                  {preview ? currencyFormatter.format(preview.ptuCost) : "--"}
                </strong>
                <small>{text.summary.perMonth}</small>
              </article>
              <article>
                <span>{text.summary.estimatedSavings}</span>
                <strong
                  className={
                    preview && preview.savings >= 0
                      ? "positive-text"
                      : "negative-text"
                  }
                >
                  {preview ? `${preview.savings.toFixed(2)}%` : "--"}
                </strong>
                <small>{text.summary.ptuVersusPaygo}</small>
              </article>
            </section>

            <section className="content-card results-card">
              <div className="results-toolbar">
                <div
                  className="tab-list"
                  role="tablist"
                  aria-label={text.results.ariaLabel}
                >
                  <button
                    className={activeTab === "comparison" ? "active" : ""}
                    type="button"
                    role="tab"
                    aria-selected={activeTab === "comparison"}
                    onClick={() => setActiveTab("comparison")}
                  >
                    {text.results.comparison}
                    {results.length > 0 ? <span>{results.length}</span> : null}
                  </button>
                  <button
                    className={activeTab === "explanations" ? "active" : ""}
                    type="button"
                    role="tab"
                    aria-selected={activeTab === "explanations"}
                    onClick={() => setActiveTab("explanations")}
                  >
                    {text.results.calculationDetails}
                  </button>
                </div>
                <button
                  className="button button-secondary button-small"
                  type="button"
                  disabled={results.length === 0}
                  onClick={() => exportResultsToExcel(results, language)}
                >
                  {text.results.exportExcel}
                </button>
              </div>

              {results.length === 0 ? (
                <div className="empty-state">
                  <span aria-hidden="true">+</span>
                  <h2>{text.results.emptyTitle}</h2>
                  <p>{text.results.emptyDescription}</p>
                </div>
              ) : activeTab === "comparison" ? (
                <>
                  <ResultsTable
                    results={results}
                    onRemove={(id) =>
                      setResults((current) =>
                        current.filter((result) => result.id !== id),
                      )
                    }
                    language={language}
                  />
                  <div className="chart-grid">
                    <MetricBars
                      title={text.results.monthlyPtuCost}
                      description={text.results.monthlyPtuCostDescription}
                      results={results}
                      value={(result) => result.ptuCost}
                      format={(value) => currencyFormatter.format(value)}
                    />
                    <MetricBars
                      title={text.results.throughputEfficiency}
                      description={
                        text.results.throughputEfficiencyDescription
                      }
                      results={results}
                      value={(result) => result.tpmPerDollar}
                      format={(value) => value.toFixed(2)}
                    />
                  </div>
                </>
              ) : (
                <ExplanationPanel results={results} language={language} />
              )}
            </section>
          </div>
        </section>

        <div id="methodology">
          <ReferenceInfo language={language} />
        </div>

        <CatalogEditor
          catalog={catalog}
          onCatalogChange={updateCatalog}
          language={language}
        />
      </main>

      <footer>
        <span>Azure Foundry PTU Cost Planner</span>
        <span>
          {text.footer.disclaimer}
        </span>
        <span>
          {text.footer.author}:{" "}
          <a href="mailto:minggu@microsoft.com">minggu@microsoft.com</a>
        </span>
      </footer>
    </div>
  );
}

export default App;
