import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { bundledCatalog } from "../data/catalog";
import { getUiText } from "../i18n";
import type { Language } from "../i18n";
import { CalculatorForm } from "./CalculatorForm";

function renderForm(modelName: string, language: Language = "en") {
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
  it.each(["en", "zh-CN"] satisfies Language[])("shows Astra cache and context controls in %s", (language) => {
    const html = renderForm("gpt-6-astra", language);
    const text = getUiText(language).calculator;
    expect(html).toContain(text.contextMode);
    expect(html).toContain(text.cacheWriteTokens);
    expect(html).toContain(text.astraHint);
    expect(html).toContain('value="long" selected=""');
    expect(html).not.toContain(text.imageInputTokens);
  });

  it.each(["en", "zh-CN"] satisfies Language[])("uses measured image token controls in %s", (language) => {
    const html = renderForm("gpt-image-2", language);
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
});
