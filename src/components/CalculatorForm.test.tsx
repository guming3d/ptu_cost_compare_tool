import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import App from "../App";
import { bundledCatalog } from "../data/catalog";
import { getUiText } from "../i18n";
import type { Language } from "../i18n";
import { CalculatorForm } from "./CalculatorForm";
import { NumberField } from "./NumberField";
import { CostOptimizer } from "./CostOptimizer";
import { ResultsTable } from "./ResultsTable";
import { CatalogEditor } from "./CatalogEditor";
import { PtuEstimationPanel } from "./PtuEstimationPanel";
import { calculateCostOptimization, calculateScenario } from "../lib/calculations";
import { exportResultsToExcel } from "../lib/exportExcel";

function renderForm(
  modelName: string,
  language: Language = "en",
  ptuOverride = false,
  cacheWriteOverride = false,
) {
  const selectedModel = bundledCatalog.models.find((model) => model["model name"].includes(modelName));
  if (!selectedModel) {
    throw new Error(`Missing model: ${modelName}`);
  }
  const onChange = () => {};
  return renderToStaticMarkup(
    <CalculatorForm
      models={bundledCatalog.models}
      selectedModelName={selectedModel["model name"]}
      selectedModel={selectedModel}
      onModelChange={onChange}
      inputTextTokens={2000}
      onInputTextTokensChange={onChange}
      outputTokens={7024}
      onOutputTokensChange={onChange}
      rpm={10}
      onRpmChange={onChange}
      cacheHitRate={0}
      onCacheHitRateChange={onChange}
      cacheWriteTokens={0}
      onCacheWriteTokensChange={onChange}
      cacheWriteOverride={cacheWriteOverride}
      onUseAutomaticCacheWriteTokens={onChange}
      contextMode="long"
      onContextModeChange={onChange}
      imageInputTokens={1229}
      onImageInputTokensChange={onChange}
      images={[]}
      onImagesChange={onChange}
      deploymentType="Global / Data Zone"
      onDeploymentTypeChange={onChange}
      commitmentType="Monthly"
      onCommitmentTypeChange={onChange}
      manualRequiredPtus={100}
      onManualRequiredPtusChange={onChange}
      ptuOverride={ptuOverride}
      onPtuOverrideChange={onChange}
      preview={null}
      error={null}
      onAdd={onChange}
      onClear={onChange}
      hasResults={false}
      language={language}
    />,
  );
}

describe("model-specific workload controls", () => {
  it("links the GitHub repository beside the footer contact address", () => {
    const footer = renderToStaticMarkup(<App />).match(/<footer>.*?<\/footer>/s)?.[0];
    expect(footer).toContain(
      '<a href="mailto:minggu@microsoft.com">minggu@microsoft.com</a> | <a href="https://github.com/guming3d/ptu_cost_compare_tool" target="_blank" rel="noreferrer">GitHub</a>',
    );
  });

  it("defaults the app to automatically calculated cache writes", () => {
    const text = getUiText("en").calculator;
    const html = renderToStaticMarkup(<App />);
    expect(html).toContain(renderToStaticMarkup(
      <NumberField
        label={text.cacheWriteTokens}
        value={3500}
        onChange={() => {}}
        step={0.01}
        hint={text.cacheWriteHint}
      />,
    ));
    expect(html).not.toContain(text.useAutomaticCacheWrites);
  });

  it.each(["en", "zh-CN"] satisfies Language[])(
    "offers automatic cache writes only after a manual override in %s",
    (language) => {
      const text = getUiText(language).calculator;
      for (const name of ["gpt-6-astra", "gpt-6-sol", "gpt-6.1-sol", "gpt-6-luna"]) {
        expect(renderForm(name, language)).toContain(renderToStaticMarkup(
          <span className="field-hint">{text.cacheWriteHint}</span>,
        ));
        expect(renderForm(name, language)).not.toContain(text.useAutomaticCacheWrites);
        expect(renderForm(name, language, false, true)).toContain(text.useAutomaticCacheWrites);
      }
      expect(renderForm("GPT-4o-mini", language, false, true))
        .not.toContain(text.useAutomaticCacheWrites);
    },
  );

  it.each(["en", "zh-CN"] satisfies Language[])("shows Astra cache and context controls in %s", (language) => {
    const html = renderForm("gpt-6-astra", language);
    const text = getUiText(language).calculator;
    expect(html).toContain(text.contextMode);
    expect(html).toContain(text.cacheWriteTokens);
    expect(html).toContain(renderToStaticMarkup(
      <span className="field-hint">{text.normalizedContextHint}</span>,
    ));
    expect(html).toContain('value="long" selected=""');
    expect(html).not.toContain(text.imageInputTokens);
  });

  it.each(["en", "zh-CN"] satisfies Language[])("shows Sol and Luna context controls with the shared price baseline in %s", (language) => {
    const text = getUiText(language).calculator;
    for (const name of ["gpt-6-sol", "gpt-6.1-sol", "gpt-6-luna"]) {
      const html = renderForm(name, language);
      expect(html).toContain(text.contextMode);
      expect(html).toContain(text.cacheWriteTokens);
      expect(html).toContain(renderToStaticMarkup(
        <span className="field-hint">{text.normalizedContextHint}</span>,
      ));
      expect(html).toContain('value="long" selected=""');
      expect(html).not.toContain(text.overridePtus);
    }
  });

  it.each(["en", "zh-CN"] satisfies Language[])("uses measured image token controls in %s", (language) => {
    const text = getUiText(language).calculator;
    for (const name of ["gpt-image-2 (", "gpt-image-2.5-flare"]) {
      const html = renderForm(name, language);
      expect(html).toContain(text.textInputTokens);
      expect(html).toContain(text.imageInputTokens);
      expect(html).toContain(text.imageOutputTokens);
      expect(html).not.toContain('type="range"');
      expect(html).toContain("Global Standard");
      expect(html).toContain(text.imageCacheHint);
      expect(html).toContain(text.imagePaygoScopeHint);
      expect(html).toContain(text.imageTokenHint);
      expect(html).toContain(text.rpmHint);
      expect(html).toContain('value="1229"');
      expect(html).toContain('value="7024"');
      expect(html).not.toContain(renderToStaticMarkup(
        <span className="field-label">{text.inputTokens}</span>,
      ));
      expect(html).not.toContain(renderToStaticMarkup(
        <span className="field-label">{text.outputTokens}</span>,
      ));
      expect(html).not.toContain(text.addImage);
      expect(html).not.toContain(text.contextMode);
      expect(html).not.toContain(text.cacheWriteTokens);
    }
  });

  it("does not expose new controls for existing models", () => {
    const text = getUiText("en").calculator;
    for (const name of ["gpt-5.6-luna", "GPT-4o-mini", "GLM 5.2"]) {
      const html = renderForm(name);
      expect(html).not.toContain(text.contextMode);
      expect(html).not.toContain(text.cacheWriteTokens);
      expect(html).not.toContain(text.imageInputTokens);
      expect(html).not.toContain(text.textInputTokens);
      expect(html).toContain(text.inputTokens);
      expect(html).toContain(text.outputTokens);
      expect(html).toContain('type="range"');
    }
  });

  it.each(["en", "zh-CN"] satisfies Language[])(
    "sizes Fireworks models automatically with an optional override in %s",
    (language) => {
      const text = getUiText(language).calculator;
      for (const name of ["DeepSeek V4 Pro", "DeepSeek V4.1 Flash"]) {
        const automatic = renderForm(name, language);
        expect(automatic).toContain(text.overridePtus);
        expect(automatic).toContain(text.automaticFireworksHint);
        expect(automatic).not.toContain(text.requiredPtus);

        const overridden = renderForm(name, language, true);
        expect(overridden).toContain(text.requiredPtus);
        expect(overridden).toContain('value="100"');
      }
    },
  );

  it.each(["en", "zh-CN"] satisfies Language[])(
    "shows V4.1 Flash as Global-only without changing existing deployment controls in %s",
    (language) => {
      const text = getUiText(language).calculator;
      const html = renderForm("DeepSeek V4.1 Flash", language);
      expect(html).toContain('value="fireworks DeepSeek V4.1 Flash" selected=""');
      expect(html).toContain(text.globalProvisionedOnly);
      expect(html).not.toContain(text.provisionedDeployment);
      expect(html).not.toContain(text.contextMode);
      expect(html).not.toContain(text.cacheWriteTokens);
      expect(renderForm("DeepSeek V4 Pro", language)).not.toContain(text.globalProvisionedOnly);
      expect(renderForm("gpt-5.6-luna", language)).toContain(text.provisionedDeployment);
    },
  );

  it("does not offer a PTU override for Azure OpenAI models", () => {
    const text = getUiText("en").calculator;
    const html = renderForm("gpt-5.6-luna", "en", true);
    expect(html).not.toContain(text.overridePtus);
    expect(html).not.toContain(text.requiredPtus);
  });

  it.each(["en", "zh-CN"] satisfies Language[])("exposes exact deployment choices and manual benchmark requirements in %s", (language) => {
    const text = getUiText(language).calculator;
    const glm = renderForm("FW-GLM-5.3", language);
    expect(glm).toContain('value="Global"');
    expect(glm).toContain('value="Data Zone"');
    expect(glm).toContain('value="Global (standard capacity)"');
    expect(glm).not.toContain('value="Regional"');
    expect(glm).toContain(text.manualDeploymentHint);
    expect(glm).toContain(text.requiredPtus);
    expect(glm).not.toContain(text.overridePtus);
    expect(renderForm("azure Llama-3.3", language)).not.toContain('value="Regional"');
    const flare = renderForm("gpt-image-2.5-flare", language);
    expect(flare).toContain(text.imageInputTokens);
    expect(flare).not.toContain(text.paygoUnavailable);
    expect(renderForm("DeepSeek v3.2", language)).toContain(text.paygoRetired);
    expect(renderForm("gpt-4.1 (", language)).toContain(text.promptLimit);
  });

  it.each(["en", "zh-CN"] satisfies Language[])("renders unavailable comparisons without fake savings or invalid chart values in %s", (language) => {
    const selectedModel = bundledCatalog.models.find((entry) => entry["model name"] === "fireworks DeepSeek v3.2")!;
    const input = {
      model: selectedModel,
      inputTextTokens: 2000, outputTokens: 100, rpm: 10, cacheHitRate: 0,
      images: [], commitmentType: "Monthly" as const, deploymentType: "Global / Data Zone" as const,
    };
    const result = calculateScenario(input);
    const optimizer = renderToStaticMarkup(
      <CostOptimizer optimization={calculateCostOptimization(input)} currentRpm={10} language={language} />,
    );
    const table = renderToStaticMarkup(<ResultsTable results={[result]} onRemove={() => {}} language={language} />);
    expect(optimizer).toContain(getUiText(language).optimizer.paygoUnavailable);
    expect(optimizer).toContain(getUiText(language).optimizer.rankingTitle);
    expect(optimizer).not.toContain(getUiText(language).optimizer.paygoReference);
    expect(optimizer).not.toContain('class="paygo-line"');
    expect(optimizer).not.toContain("NaN");
    expect(optimizer).not.toContain("Infinity");
    expect(table.match(/N\/A/g)).toHaveLength(2);
    expect(table).not.toContain("$0.00");
  });

  it("renders all six custom automatic deployment curves with separately scoped PayGO lines", () => {
    const selectedModel = bundledCatalog.models.find((entry) => entry["model name"] === "FW-GLM-5.3")!;
    const optimization = calculateCostOptimization({
      model: { ...selectedModel, "PTU sizing mode": "automatic", "output token multiple ratio": 1 },
      inputTextTokens: 2000, outputTokens: 100, rpm: 10, cacheHitRate: 0,
      images: [], commitmentType: "Monthly", deploymentType: "Global",
    });
    const html = renderToStaticMarkup(<CostOptimizer optimization={optimization} currentRpm={10} language="en" />);
    expect(html.match(/class="ptu-line"/g)).toHaveLength(6);
    expect(html.match(/class="paygo-line"/g)).toHaveLength(2);
    expect(html).toContain("US Data Zone Standard");
    expect(html).toContain("Global Standard");
    expect(html).not.toContain("NaN");
  });

  it("warns about an older browser catalog without replacing customizations", () => {
    const html = renderToStaticMarkup(<CatalogEditor
      catalog={{ ...bundledCatalog, metadata: { ...bundledCatalog.metadata, "verified date": "2026-09-29" } }}
      onCatalogChange={() => {}} language="en"
    />);
    expect(html).toContain(getUiText("en").catalog.outdated);
  });

  it("exports unavailable costs as N/A with the pricing scope", async () => {
    const selectedModel = bundledCatalog.models.find((entry) => entry["model name"] === "fireworks DeepSeek v3.2")!;
    const result = calculateScenario({
      model: selectedModel,
      inputTextTokens: 2000, outputTokens: 100, rpm: 10, cacheHitRate: 0,
      images: [], commitmentType: "Monthly", deploymentType: "Global / Data Zone",
    });
    const createObjectURL = vi.fn((_blob: Blob) => "blob:test");
    const link = { href: "", download: "", click: vi.fn(), remove: vi.fn() };
    vi.stubGlobal("document", { createElement: () => link, body: { append: vi.fn() } });
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL: vi.fn() });
    try {
      exportResultsToExcel([result], "en");
      const blob = createObjectURL.mock.calls[0][0] as unknown as Blob;
      const workbook = await blob.text();
      expect(workbook.match(/<td>N\/A<\/td>/g)).toHaveLength(2);
      expect(workbook).toContain(result.paygoPricingScope);
      expect(workbook).toContain("PayGO pricing scope");
      expect(workbook).not.toContain("null");
      expect(link.click).toHaveBeenCalledOnce();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("opens on live PTU estimation without form submit buttons or PayGO comparison clutter", () => {
    const ui = getUiText("en");
    const html = renderToStaticMarkup(<App />);
    expect(html).toContain(ui.workspace.estimationTab);
    expect(html).toContain(ui.workspace.comparisonTab);
    expect(html).toContain('id="workspace-tab-estimation" class="workspace-tab active"');
    expect(html).toContain(ui.estimation.targetPtus);
    expect(html).toContain(ui.estimation.backendCalculationTitle);
    expect(html).toContain(ui.guide.title);
    expect(html).toContain(ui.guide.modelTitle);
    expect(html).toContain('id="model-select"');
    expect(html.indexOf(ui.estimation.backendCalculationTitle))
      .toBeLessThan(html.indexOf(ui.normalization.title));
    expect(html).not.toContain(ui.optimizer.title);
    expect(html).not.toContain(ui.results.emptyTitle);
    const aside = html.match(/<aside.*?<\/aside>/s)?.[0] ?? "";
    expect(aside).not.toContain(ui.calculator.addComparison);
  });

  it.each(["en", "zh-CN"] satisfies Language[])(
    "renders live backend PTU sizing steps for standard models while excluding PayGO-only steps in %s",
    (language) => {
      const ui = getUiText(language);
      const selectedModel = bundledCatalog.models.find((entry) =>
        entry["model name"].includes("GPT-4o-mini"),
      )!;
      const result = calculateScenario({
        model: selectedModel,
        inputTextTokens: 3500,
        outputTokens: 300,
        rpm: 60,
        cacheHitRate: 25,
        images: [],
        commitmentType: "Monthly",
        deploymentType: "Global / Data Zone",
      });
      const html = renderToStaticMarkup(
        <PtuEstimationPanel
          model={selectedModel}
          result={result}
          error={null}
          cacheWriteOverride={false}
          sourceUrl={bundledCatalog.metadata["ptu sizing source"]}
          comparisonCount={2}
          justAdded={true}
          onAddComparison={() => {}}
          onOpenComparison={() => {}}
          language={language}
        />,
      );
      expect(html).toContain(ui.estimation.targetPtus);
      expect(html).toContain(ui.estimation.backendCalculationTitle);
      expect(html).toContain(ui.estimation.savedFeedback);
      expect(html).toContain('<span class="count-badge">2</span>');
      const calculationCard =
        html.match(/<section class="content-card live-calculation-card">.*?<\/section>/s)?.[0] ?? "";
      expect(calculationCard).toContain("target-ptu-step");
      expect(calculationCard).toContain(ui.estimation.flowWorkload);
      expect(calculationCard).toContain(ui.estimation.flowDemand);
      expect(calculationCard).toContain(ui.estimation.flowDeployment);
      expect(calculationCard).toContain(
        `${result.deployedPtus.toLocaleString(language === "en" ? "en-US" : "zh-CN")} PTUs`,
      );
      expect(calculationCard).toContain(`<summary>${ui.estimation.showCalculationSteps}</summary>`);
      expect(calculationCard).toContain(ui.estimation.stepRequiredPtus);
      expect(calculationCard).toContain('class="formula-block"');
      expect(calculationCard).toContain('<code>');
      expect(calculationCard).not.toContain("PayGO");
      expect(calculationCard).not.toContain("inputPricePer1k");
    },
  );

  it("ranks current PTU costs while keeping the traffic chart available on demand", () => {
    const model = bundledCatalog.models.find((entry) =>
      entry["model name"].includes("GPT-4o-mini"),
    )!;
    const input = {
      model, inputTextTokens: 3500, outputTokens: 300, rpm: 60,
      cacheHitRate: 25, images: [], commitmentType: "Monthly" as const,
      deploymentType: "Global / Data Zone" as const,
    };
    const optimization = calculateCostOptimization(input);
    const html = renderToStaticMarkup(
      <CostOptimizer optimization={optimization} currentRpm={60} language="en" />,
    );
    const ranking = html.match(/<ol>.*?<\/ol>/s)?.[0] ?? "";
    const costs = [...ranking.matchAll(/<strong>\$([\d,]+)<small> \/ month<\/small><\/strong>/g)]
      .map((match) => Number(match[1].replaceAll(",", "")));
    expect(costs).toHaveLength(optimization.configurations.length);
    expect(costs).toEqual([...costs].sort((a, b) => a - b));
    expect(ranking).toContain("ranking-best");
    expect(html).toContain(`<summary>${getUiText("en").optimizer.showTrafficChart}</summary>`);
    expect(html).toContain(getUiText("en").optimizer.paygoReference);
  });

  it.each(["en", "zh-CN"] satisfies Language[])(
    "explains missing manual PTU benchmark inputs in the estimation view in %s",
    (language) => {
      const ui = getUiText(language);
      const glm = bundledCatalog.models.find(
        (entry) => entry["model name"] === "FW-GLM-5.3",
      )!;
      const html = renderToStaticMarkup(
        <PtuEstimationPanel
          model={glm}
          result={null}
          error="Benchmarked required PTUs must be a positive number."
          cacheWriteOverride={false}
          sourceUrl={bundledCatalog.metadata["ptu sizing source"]}
          comparisonCount={0}
          justAdded={false}
          onAddComparison={() => {}}
          onOpenComparison={() => {}}
          language={language}
        />,
      );
      expect(html).toContain('role="alert"');
      expect(html).toContain(ui.estimation.unavailableTitle);
      expect(html).not.toContain("<ol");
    },
  );
});
