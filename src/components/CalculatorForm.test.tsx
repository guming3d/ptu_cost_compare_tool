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
      for (const name of ["gpt-6-astra", "gpt-6-sol", "gpt-6.1-sol"]) {
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

  it.each(["en", "zh-CN"] satisfies Language[])("shows Sol context controls with the shared price baseline in %s", (language) => {
    const text = getUiText(language).calculator;
    for (const name of ["gpt-6-sol", "gpt-6.1-sol"]) {
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
    const html = renderForm("gpt-image-2 (", language);
    const text = getUiText(language).calculator;
    expect(html).toContain(text.imageInputTokens);
    expect(html).toContain(text.imageOutputTokens);
    expect(html).toContain(text.textCacheHitRate);
    expect(html).toContain('value="1229"');
    expect(html).not.toContain(text.addImage);
    expect(html).not.toContain(text.contextMode);
    expect(html).not.toContain(text.cacheWriteTokens);
  });

  it("does not expose new controls for existing models", () => {
    const text = getUiText("en").calculator;
    for (const name of ["gpt-5.6-luna", "GPT-4o-mini", "GLM 5.2"]) {
      const html = renderForm(name);
      expect(html).not.toContain(text.contextMode);
      expect(html).not.toContain(text.cacheWriteTokens);
      expect(html).not.toContain(text.imageInputTokens);
      expect(html).toContain(text.outputTokens);
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
    expect(flare).toContain(text.paygoUnavailable);
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
});
