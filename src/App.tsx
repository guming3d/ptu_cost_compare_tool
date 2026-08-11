import { useEffect, useMemo, useState } from "react";
import { CalculatorForm } from "./components/CalculatorForm";
import { CatalogEditor } from "./components/CatalogEditor";
import { ExplanationPanel } from "./components/ExplanationPanel";
import { MetricBars } from "./components/MetricBars";
import { ReferenceInfo } from "./components/ReferenceInfo";
import { ResultsTable } from "./components/ResultsTable";
import { readStoredCatalog } from "./data/catalog";
import { calculateScenario } from "./lib/calculations";
import { exportResultsToExcel } from "./lib/exportExcel";
import type {
  CatalogDocument,
  CommitmentType,
  ComparisonResult,
  DeploymentType,
  WorkloadImage,
} from "./types";

type ActiveTab = "comparison" | "explanations";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

function App() {
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
        error instanceof Error ? error.message : "Unable to calculate scenario.",
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
          aria-label="Azure Foundry PTU Cost Planner home"
        >
          Azure Foundry PTU Cost Planner
        </a>
        <nav aria-label="Page navigation">
          <a href="#calculator">Calculator</a>
          <a
            href={catalog.metadata["ptu sizing source"]}
            target="_blank"
            rel="noreferrer"
          >
            Microsoft sizing guide
          </a>
        </nav>
      </header>

      <main id="top">
        <section className="hero">
          <div>
            <h1>Compare PTU and PayGO cost</h1>
            <p>
              Estimate provisioned capacity, monthly spend, utilization, and
              cost efficiency across the bundled model catalog.
            </p>
          </div>
          <dl className="catalog-summary">
            <div>
              <dt>Models</dt>
              <dd>{catalog.models.length}</dd>
            </div>
            <div>
              <dt>Catalog verified</dt>
              <dd>{catalog.metadata["verified date"]}</dd>
            </div>
            <div>
              <dt>Currency</dt>
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
          />

          <div className="results-column">
            <section className="summary-grid" aria-label="Current cost estimate">
              <article>
                <span>PayGO estimate</span>
                <strong>
                  {preview ? currencyFormatter.format(preview.paygoCost) : "--"}
                </strong>
                <small>per month</small>
              </article>
              <article>
                <span>PTU estimate</span>
                <strong>
                  {preview ? currencyFormatter.format(preview.ptuCost) : "--"}
                </strong>
                <small>per month</small>
              </article>
              <article>
                <span>Estimated savings</span>
                <strong
                  className={
                    preview && preview.savings >= 0
                      ? "positive-text"
                      : "negative-text"
                  }
                >
                  {preview ? `${preview.savings.toFixed(2)}%` : "--"}
                </strong>
                <small>PTU versus PayGO</small>
              </article>
            </section>

            <section className="content-card results-card">
              <div className="results-toolbar">
                <div className="tab-list" role="tablist" aria-label="Results">
                  <button
                    className={activeTab === "comparison" ? "active" : ""}
                    type="button"
                    role="tab"
                    aria-selected={activeTab === "comparison"}
                    onClick={() => setActiveTab("comparison")}
                  >
                    Comparison
                    {results.length > 0 ? <span>{results.length}</span> : null}
                  </button>
                  <button
                    className={activeTab === "explanations" ? "active" : ""}
                    type="button"
                    role="tab"
                    aria-selected={activeTab === "explanations"}
                    onClick={() => setActiveTab("explanations")}
                  >
                    Calculation details
                  </button>
                </div>
                <button
                  className="button button-secondary button-small"
                  type="button"
                  disabled={results.length === 0}
                  onClick={() => exportResultsToExcel(results)}
                >
                  Export Excel
                </button>
              </div>

              {results.length === 0 ? (
                <div className="empty-state">
                  <span aria-hidden="true">+</span>
                  <h2>Add a scenario to start comparing.</h2>
                  <p>
                    The current estimate updates live. Add it to keep a snapshot
                    and compare another model or commitment.
                  </p>
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
                  />
                  <div className="chart-grid">
                    <MetricBars
                      title="Monthly PTU cost"
                      description="Provisioned cost after the configured commitment discount."
                      results={results}
                      value={(result) => result.ptuCost}
                      format={(value) => currencyFormatter.format(value)}
                    />
                    <MetricBars
                      title="Throughput efficiency"
                      description="Millions of workload tokens per minute for each PTU dollar."
                      results={results}
                      value={(result) => result.tpmPerDollar}
                      format={(value) => value.toFixed(2)}
                    />
                  </div>
                </>
              ) : (
                <ExplanationPanel results={results} />
              )}
            </section>
          </div>
        </section>

        <div id="methodology">
          <ReferenceInfo />
        </div>

        <CatalogEditor catalog={catalog} onCatalogChange={updateCatalog} />
      </main>

      <footer>
        <span>Azure Foundry PTU Cost Planner</span>
        <span>
          Pricing is indicative and can vary by geography, agreement, and
          deployment type.
        </span>
        <span>
          Author: <a href="mailto:minggu@microsoft.com">minggu@microsoft.com</a>
        </span>
      </footer>
    </div>
  );
}

export default App;
