import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { bundledCatalog } from "../data/catalog";
import { getUiText } from "../i18n";
import type { Language } from "../i18n";
import { calculateAutomaticCacheWriteTokens, calculateScenario } from "../lib/calculations";
import type { ContextMode, ScenarioInput } from "../types";
import { TokenNormalizationPanel } from "./TokenNormalizationPanel";

function renderPanel(
  modelName = "gpt-6.1-sol",
  changes: Partial<ScenarioInput> = {},
  language: Language = "en",
  cacheWriteOverride = false,
) {
  const model = bundledCatalog.models.find((entry) => entry["model name"].includes(modelName));
  if (!model) {
    throw new Error(`Missing model: ${modelName}`);
  }
  const input: ScenarioInput = {
    model,
    inputTextTokens: 3500,
    outputTokens: 300,
    cacheHitRate: 90,
    rpm: 60,
    images: [],
    contextMode: "short",
    commitmentType: "Monthly",
    deploymentType: "Global / Data Zone",
    ...changes,
  };
  input.cacheWriteTokens = changes.cacheWriteTokens ??
    calculateAutomaticCacheWriteTokens(input.inputTextTokens, input.cacheHitRate);
  return renderToStaticMarkup(
    <TokenNormalizationPanel
      model={input.model}
      result={calculateScenario(input)}
      cacheWriteOverride={cacheWriteOverride}
      sourceUrl={bundledCatalog.metadata["ptu sizing source"]}
      language={language}
    />,
  );
}

describe("live token normalization panel", () => {
  it.each(["en", "zh-CN"] satisfies Language[])("shows the actual conversion in %s", (language) => {
    const html = renderPanel("gpt-6.1-sol", {}, language);
    const text = getUiText(language).normalization;
    for (const label of [
      text.title, text.inputSplit, text.conversion, text.buckets.cached,
      text.buckets.cacheWrite, text.noDoubleCounting, text.automaticWrites,
      text.requestInput, text.cachedPrefix, text.inputStart, text.inputEnd, text.prefixOrder,
      text.sum, text.multiplyRpm, text.divideCapacity, text.roundDeployment,
    ]) {
      expect(html).toContain(label);
    }
    expect(html).toContain("x 0.05 <small>(5%)</small>");
    expect(html).toContain("x 1.25 <small>(125%)</small>");
    expect(html).toContain("= 157.5</strong>");
    expect(html).toContain("= 437.5</strong>");
    expect(html).toContain(`${text.buckets.cached}: 3,500 x 90% =`);
    expect(html).toContain(`${text.buckets.cacheWrite}: 3,500 x (100% - 90%) = 350.`);
    expect(html).toContain("<strong>2,095</strong>");
    expect(html).toContain("<strong>125,700</strong>");
    expect(html).toContain("<strong>41.9</strong>");
    expect(html).toContain("<strong>45</strong>");
    expect(html).not.toContain(text.catalogOverride);
    expect(html).toContain(bundledCatalog.metadata["ptu sizing source"]);
  });

  it.each([
    ["gpt-6-astra", "short", 0.1, 1.25, 5],
    ["gpt-6-astra", "long", 0.2, 2.5, 7.5],
    ["gpt-6-sol", "short", 0.1, 1.25, 5],
    ["gpt-6-sol", "long", 0.2, 2.5, 7.5],
    ["gpt-6.1-sol", "short", 0.05, 1.25, 5],
    ["gpt-6.1-sol", "long", 0.1, 2.5, 7.5],
  ] satisfies [string, ContextMode, number, number, number][])(
    "shows the %s %s-context read/write/output weights",
    (name, contextMode, readWeight, writeWeight, outputWeight) => {
      const html = renderPanel(name, { contextMode });
      for (const weight of [readWeight, writeWeight, outputWeight]) {
        expect(html).toContain(`x ${weight} <small>(${weight * 100}%)</small>`);
      }
      expect(html).not.toContain(getUiText("en").normalization.catalogOverride);
    },
  );

  it("shows the remaining uncached input after manual writes", () => {
    const html = renderPanel("gpt-6.1-sol", { cacheWriteTokens: 100 }, "en", true);
    const text = getUiText("en").normalization;
    expect(html).toContain("3,500 = 3,150 + 100 + 250");
    expect(html).toContain(text.manualWrites);
    expect(html).not.toContain(text.automaticWrites);
  });

  it.each([0, 100, 350])(
    "keeps the cached prefix first when manual cache writes change to %s",
    (cacheWriteTokens) => {
      const html = renderPanel("gpt-6.1-sol", { cacheWriteTokens }, "en", true);
      const bar = html.match(/<div class="normalization-split-bar">(.*?)<\/div>/)?.[1];
      expect(bar).toBeDefined();
      const segments = [...bar!.matchAll(/data-category="([^"]+)"[^>]*style="width:([^"]+)"/g)];
      expect(segments.map((segment) => segment[1])).toEqual([
        "cached",
        ...(cacheWriteTokens > 0 ? ["cacheWrite"] : []),
        ...(cacheWriteTokens < 350 ? ["uncached"] : []),
      ]);
      expect(segments[0][2]).toBe("90%");
      expect(segments.reduce((sum, segment) => sum + Number.parseFloat(segment[2]), 0))
        .toBeCloseTo(100);
      expect(html).toContain(
        'class="normalization-split-boundary normalization-prefix-boundary" style="left:90%"',
      );
      if (cacheWriteTokens > 0 && cacheWriteTokens < 350) {
        expect(html).toContain(
          `class="normalization-split-boundary" style="left:${(3150 + cacheWriteTokens) / 3500 * 100}%"`,
        );
      }
    },
  );

  it.each([
    [0, 0, ["uncached"]],
    [0, 3500, ["cacheWrite"]],
    [100, 0, ["cached"]],
  ])(
    "renders only nonempty segments at %s%% cache hit with %s writes",
    (cacheHitRate, cacheWriteTokens, categories) => {
      const html = renderPanel("gpt-6.1-sol", { cacheHitRate, cacheWriteTokens }, "en", true);
      const bar = html.match(/<div class="normalization-split-bar">(.*?)<\/div>/)?.[1];
      expect(bar).toBeDefined();
      expect([...bar!.matchAll(/data-category="([^"]+)"/g)].map((segment) => segment[1]))
        .toEqual(categories);
      expect(bar).toContain("width:100%");
      expect(html).not.toContain('class="normalization-split-boundary');
    },
  );

  it("renders an empty input track without cache boundary markers", () => {
    const html = renderPanel("gpt-6.1-sol", { inputTextTokens: 0, cacheWriteTokens: 0 });
    expect(html).toContain('<div class="normalization-split-bar"></div>');
    expect(html).not.toContain('class="normalization-split-boundary');
  });

  it.each([
    { inputTextTokens: 0, outputTokens: 0, rpm: 0 },
    { cacheHitRate: 0 },
    { cacheHitRate: 100 },
    { inputTextTokens: 31 },
  ])("handles empty and extreme inputs without invalid chart widths: %j", (changes) => {
    const html = renderPanel("gpt-6.1-sol", changes);
    expect(html).not.toMatch(/NaN|Infinity|width:-/);
  });

  it("shows regional rounding parameters", () => {
    const html = renderPanel("gpt-6.1-sol", { deploymentType: "Regional" });
    expect(html).toContain("<strong>50</strong>");
    expect(html).toContain("max(50, ceil(41.9 / 50) x 50)");
  });

  it("respects custom catalog weights and warns about stale price ratios", () => {
    const model = bundledCatalog.models[0];
    const html = renderPanel("gpt-6.1-sol", {
      model: {
        ...model,
        "PTU input token weights": { uncached: 1, cached: 0.1, cacheWrite: 1.25 },
      },
    });
    expect(html).toContain(getUiText("en").normalization.catalogOverride);
    expect(html).toContain("x 0.1 <small>(10%)</small>");
    expect(html).toContain("<strong>135,150</strong>");
  });

  it("does not show stale numbers when the workload is invalid", () => {
    const html = renderToStaticMarkup(
      <TokenNormalizationPanel
        model={bundledCatalog.models[0]}
        result={null}
        cacheWriteOverride={false}
        sourceUrl={bundledCatalog.metadata["ptu sizing source"]}
        language="en"
      />,
    );
    expect(html).toContain(getUiText("en").normalization.unavailable);
    expect(html).not.toContain("<table");
    expect(html).not.toContain("normalization-flow");
  });
});
