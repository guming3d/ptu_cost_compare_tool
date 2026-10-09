import { describe, expect, it } from "vitest";
import { bundledCatalog, isCatalogDocument } from "../data/catalog";
import type { ContextMode, DeploymentType, ModelConfig, ScenarioInput } from "../types";
import {
  calculateCostOptimization,
  calculateScenario,
  MINUTES_PER_MONTH,
} from "./calculations";

function model(name: string): ModelConfig {
  const result = bundledCatalog.models.find((entry) => entry["model name"].includes(name));
  if (!result) {
    throw new Error(`Missing model: ${name}`);
  }
  return result;
}

const astra = model("gpt-6-astra");
const image = model("gpt-image-2");
const sol = model("gpt-6-sol");
const sol61 = model("gpt-6.1-sol");

function scenario(selectedModel: ModelConfig, changes: Partial<ScenarioInput> = {}): ScenarioInput {
  return {
    model: selectedModel,
    inputTextTokens: 1000,
    outputTokens: 100,
    rpm: 10,
    cacheHitRate: 50,
    images: [],
    commitmentType: "Monthly",
    deploymentType: "Global / Data Zone",
    ...changes,
  };
}

describe("GPT-6 Astra normalized token accounting", () => {
  it.each([
    ["short", 0, 0, 0, 1000],
    ["short", 100, 0, 0, 100],
    ["short", 0, 1000, 0, 1250],
    ["short", 0, 0, 1000, 6000],
    ["long", 0, 0, 0, 2000],
    ["long", 100, 0, 0, 200],
    ["long", 0, 1000, 0, 2500],
    ["long", 0, 0, 1000, 12000],
  ] satisfies [ContextMode, number, number, number, number][])(
    "weights %s-context tokens at cache rate %s, writes %s, output %s",
    (contextMode, cacheHitRate, cacheWriteTokens, outputTokens, normalizedTpm) => {
      const result = calculateScenario(scenario(astra, {
        contextMode,
        cacheHitRate,
        cacheWriteTokens,
        outputTokens,
        rpm: 1,
      }));
      expect(result.normalizedTpm).toBeCloseTo(normalizedTpm);
      expect(result.requiredPtus).toBeCloseTo(normalizedTpm / 600);
    },
  );

  it.each([
    ["short", 11000, 20, 0.011, 0.0025, 5],
    ["long", 22000, 40, 0.0195, 0.005, 10],
  ] satisfies [ContextMode, number, number, number, number, number][])(
    "sizes and prices disjoint read/write/input buckets for %s context",
    (contextMode, normalizedTpm, deployedPtus, costPerRequest, writeCostPerRequest, outputWeight) => {
      const result = calculateScenario(scenario(astra, {
        contextMode,
        cacheWriteTokens: 200,
      }));
      expect(result.normalizedTpm).toBe(normalizedTpm);
      expect(result.requiredPtus).toBeCloseTo(normalizedTpm / 600);
      expect(result.deployedPtus).toBe(deployedPtus);
      expect(result.ptuCost).toBe(deployedPtus * 260);
      expect(result.paygoCost).toBeCloseTo(costPerRequest * 10 * MINUTES_PER_MONTH);
      expect(result.paygoBreakdown.cacheWriteCost).toBeCloseTo(
        writeCostPerRequest * 10 * MINUTES_PER_MONTH,
      );
      expect(result.contextMode).toBe(contextMode);
      expect(result.cacheWriteTokens).toBe(200);
      expect(result.explanation.inputs).toMatchObject({
        contextMode,
        cacheWriteTokens: 200,
        outputWeight,
        outputPricePer1k: contextMode === "long" ? 0.075 : 0.05,
      });
      const inputStep = result.explanation.steps.find((step) => step.output === "Monthly PayGO input cost");
      expect(inputStep?.formula).toContain("cache write tokens");
      expect(inputStep?.result).toBe(result.paygoBreakdown.inputCost);
      expect(result.explanation.steps.find((step) => step.output === "Normalized TPM")?.result)
        .toBe(result.normalizedTpm);
    },
  );

  it("defaults to short context and uses 50-PTU regional increments", () => {
    const result = calculateScenario(scenario(astra, {
      cacheWriteTokens: 200,
      deploymentType: "Regional",
    }));
    expect(result.contextMode).toBe("short");
    expect(result.normalizedTpm).toBe(11000);
    expect(result.deployedPtus).toBe(50);
  });

  it.each([
    { cacheHitRate: 50, cacheWriteTokens: 501 },
    { cacheHitRate: 100, cacheWriteTokens: 1 },
    { cacheWriteTokens: -1 },
    { cacheWriteTokens: Number.NaN },
    { cacheHitRate: Number.NaN },
  ])("rejects invalid cache buckets: %j", (changes) => {
    expect(() => calculateScenario(scenario(astra, changes))).toThrow(/cache/i);
  });

  it("accepts reads and writes that exactly fill the total input", () => {
    const result = calculateScenario(scenario(astra, {
      cacheWriteTokens: 500,
      outputTokens: 0,
      rpm: 1,
    }));
    expect(result.normalizedTpm).toBe(675);
    expect(result.paygoBreakdown.nonCachedInputCost).toBe(0);
  });

  it("keeps optimizer points consistent with long-context scenario results", () => {
    const input = scenario(astra, { contextMode: "long", cacheWriteTokens: 200 });
    const result = calculateScenario(input);
    const optimization = calculateCostOptimization(input);
    expect(optimization.configurations).toHaveLength(4);
    expect(optimization.configurations.find((config) =>
      config.commitmentType === "Monthly" && config.deploymentType === "Global / Data Zone",
    )?.current).toMatchObject({
      requiredPtus: result.requiredPtus,
      deployedPtus: result.deployedPtus,
      paygoCost: result.paygoCost,
      ptuCost: result.ptuCost,
    });
  });
});

describe("GPT-image-2 normalized token accounting", () => {
  const documentedWorkload = scenario(image, {
    inputTextTokens: 2000,
    imageInputTokens: 1229,
    outputTokens: 7024,
    cacheHitRate: 0,
  });

  it.each(["Global / Data Zone", "Regional"] satisfies DeploymentType[])(
    "reproduces the documented image workload for %s",
    (deploymentType) => {
      const result = calculateScenario({ ...documentedWorkload, deploymentType });
      expect(result.inputImageTokens).toBe(1229);
      expect(result.normalizedTpm).toBeCloseTo(461104);
      expect(result.requiredPtus).toBeCloseTo(384.2533333333);
      expect(result.deployedPtus).toBe(400);
      expect(result.ptuCost).toBe(104000);
      expect(result.explanation.inputs).toMatchObject({
        imageInputWeight: 1.6,
        imageOutputWeight: 6,
        imageInputPricePer1k: 0.008,
      });
      expect(result.explanation.steps.find((step) => step.output === "Normalized TPM")?.substitution)
        .toContain("3.75 x 1.6");
      expect(result.paygoBreakdown.imageCost).toBeCloseTo(
        (1229 * 0.008 / 1000) * 10 * MINUTES_PER_MONTH,
      );
      expect(result.paygoCost).toBeCloseTo(
        ((2000 * 0.005 + 1229 * 0.008 + 7024 * 0.03) / 1000) * 10 * MINUTES_PER_MONTH,
      );
      expect(result.explanation.steps.find((step) => step.output === "Monthly PayGO image cost")?.substitution)
        .toContain("0.008");
    },
  );

  it.each([
    [1200, 0, 0],
    [0, 750, 0],
    [0, 0, 200],
  ])("uses the published capacity for text %s, image input %s, image output %s",
    (inputTextTokens, imageInputTokens, outputTokens) => {
      const result = calculateScenario(scenario(image, {
        inputTextTokens,
        imageInputTokens,
        outputTokens,
        rpm: 1,
        cacheHitRate: 0,
      }));
      expect(result.requiredPtus).toBe(1);
      expect(result.deployedPtus).toBe(100);
    },
  );

  it("only deducts cached text, not image tokens", () => {
    const result = calculateScenario({ ...documentedWorkload, cacheHitRate: 100 });
    expect(result.normalizedTpm).toBeCloseTo(441104);
    expect(result.paygoBreakdown.cachedInputCost).toBeCloseTo(
      (2000 * 0.00125 / 1000) * 10 * MINUTES_PER_MONTH,
    );
    expect(result.paygoBreakdown.nonCachedInputCost).toBe(0);
    expect(result.inputImageTokens).toBe(1229);
  });

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY])("rejects image input token count %s", (imageInputTokens) => {
    expect(() => calculateScenario(scenario(image, { imageInputTokens }))).toThrow(/Image input tokens/);
  });

  it("rounds above a 100-PTU boundary rather than truncating", () => {
    const result = calculateScenario(scenario(image, {
      inputTextTokens: 120001,
      outputTokens: 0,
      rpm: 1,
      cacheHitRate: 0,
    }));
    expect(result.requiredPtus).toBeGreaterThan(100);
    expect(result.deployedPtus).toBe(200);
  });

  it("carries measured image tokens into optimization", () => {
    const optimization = calculateCostOptimization(documentedWorkload);
    expect(optimization.configurations).toHaveLength(4);
    for (const configuration of optimization.configurations) {
      expect(configuration.current.requiredPtus).toBeCloseTo(384.2533333333);
      expect(configuration.current.deployedPtus).toBe(400);
    }
  });
});

describe.each([
  { name: "gpt-6-sol", version: "2026-09-22", selectedModel: sol, shortCachePrice: 0.0002, longCachePrice: 0.0004, longCacheWeight: 0.2 },
  { name: "gpt-6.1-sol", version: "2026-09-29", selectedModel: sol61, shortCachePrice: 0.0001, longCachePrice: 0.0002, longCacheWeight: 0.1 },
])("$name published normalized sizing", ({ name, version, selectedModel, shortCachePrice, longCachePrice, longCacheWeight }) => {
  it("loads the dated model with published pricing and deployment limits", () => {
    expect(selectedModel).toMatchObject({
      "model name": `azure openai ${name} (${version})`,
      "provider": "Azure OpenAI",
      "input TPM per PTU": 3000,
      "PTU minumum deployment unit": 15,
      "PTU scale increment": 5,
      "regional PTU minimum deployment unit": 50,
      "regional PTU scale increment": 50,
      "input token price per 1k": 0.002,
      "input token price per 1k with cache hit": shortCachePrice,
      "cache write token price per 1k": 0.0025,
      "output token price per 1k": 0.01,
      "output token multiple ratio": 5,
      "PTU input token weights": { uncached: 1, cached: 0.1, cacheWrite: 1.25 },
      "long context": {
        "input token price per 1k": 0.004,
        "input token price per 1k with cache hit": longCachePrice,
        "cache write token price per 1k": 0.005,
        "output token price per 1k": 0.015,
        "output token multiple ratio": 7.5,
        "PTU input token weights": { uncached: 2, cached: longCacheWeight, cacheWrite: 2.5 },
      },
    });
    expect(isCatalogDocument(JSON.parse(JSON.stringify({
      ...bundledCatalog,
      models: [selectedModel],
    })))).toBe(true);
  });

  it.each([
    ["short", 1000, 0, 0, 0, 1000],
    ["short", 1000, 100, 0, 0, 100],
    ["short", 1000, 0, 1000, 0, 1250],
    ["short", 0, 0, 0, 1000, 5000],
    ["long", 1000, 0, 0, 0, 2000],
    ["long", 1000, 100, 0, 0, 1000 * longCacheWeight],
    ["long", 1000, 0, 1000, 0, 2500],
    ["long", 0, 0, 0, 1000, 7500],
  ] satisfies [ContextMode, number, number, number, number, number][])(
    "uses the published %s-context weight for input %s, cache rate %s, writes %s, output %s",
    (contextMode, inputTextTokens, cacheHitRate, cacheWriteTokens, outputTokens, normalizedTpm) => {
      const result = calculateScenario(scenario(selectedModel, {
        contextMode, inputTextTokens, cacheHitRate, cacheWriteTokens, outputTokens, rpm: 1,
      }));
      expect(result.normalizedTpm).toBeCloseTo(normalizedTpm);
      expect(result.requiredPtus).toBeCloseTo(normalizedTpm / 3000);
      expect(result.deployedPtus).toBe(15);
    },
  );

  it.each(["short", "long"] satisfies ContextMode[])("prices and sizes mixed %s-context buckets independently", (contextMode) => {
    const input = scenario(selectedModel, { contextMode, cacheWriteTokens: 200, rpm: 100 });
    const result = calculateScenario(input);
    const isLong = contextMode === "long";
    const normalizedPerRequest = isLong ? 1850 + 500 * longCacheWeight : 1100;
    const costPerRequest = isLong
      ? (300 * 0.004 + 500 * longCachePrice + 200 * 0.005 + 100 * 0.015) / 1000
      : (300 * 0.002 + 500 * shortCachePrice + 200 * 0.0025 + 100 * 0.01) / 1000;
    expect(result.normalizedTpm).toBeCloseTo(normalizedPerRequest * 100);
    expect(result.requiredPtus).toBeCloseTo(normalizedPerRequest * 100 / 3000);
    expect(result.deployedPtus).toBe(isLong ? 65 : 40);
    expect(result.ptuCost).toBe((isLong ? 65 : 40) * 260);
    expect(result.paygoCost).toBeCloseTo(costPerRequest * 100 * MINUTES_PER_MONTH);
    expect(result.paygoBreakdown.cacheWriteCost).toBeCloseTo(
      200 * (isLong ? 0.005 : 0.0025) / 1000 * 100 * MINUTES_PER_MONTH,
    );
    expect(result.explanation.inputs).toMatchObject({
      contextMode,
      cacheWriteTokens: 200,
      cachedInputWeight: isLong ? longCacheWeight : 0.1,
      cachedInputPricePer1k: isLong ? longCachePrice : shortCachePrice,
      outputWeight: isLong ? 7.5 : 5,
    });
    expect(result.explanation.steps.find((step) => step.output === "Normalized TPM")?.result)
      .toBe(result.normalizedTpm);
    const regional = calculateScenario({ ...input, deploymentType: "Regional", commitmentType: "Yearly" });
    expect(regional.deployedPtus).toBe(isLong ? 100 : 50);
    expect(regional.ptuCost).toBe((isLong ? 100 : 50) * 221);
    expect(regional.paygoCost).toBe(result.paygoCost);
  });

  it("retains cache capacity consumption at a 100% cache-hit rate", () => {
    const result = calculateScenario(scenario(selectedModel, { cacheHitRate: 100, outputTokens: 0 }));
    expect(result.contextMode).toBe("short");
    expect(result.normalizedTpm).toBe(1000);
    expect(result.paygoBreakdown.cachedInputCost).toBeCloseTo(shortCachePrice * 10 * MINUTES_PER_MONTH);
    expect(result.paygoBreakdown.nonCachedInputCost).toBe(0);
  });

  it("supports the existing optimizer without treating cache writes as ordinary input", () => {
    const input = scenario(selectedModel, { contextMode: "long", cacheWriteTokens: 200, rpm: 100 });
    const result = calculateScenario(input);
    const optimization = calculateCostOptimization(input);
    expect(optimization.configurations).toHaveLength(4);
    expect(optimization.configurations.find((configuration) =>
      configuration.commitmentType === "Monthly" && configuration.deploymentType === "Global / Data Zone",
    )?.current).toMatchObject({
      requiredPtus: result.requiredPtus,
      deployedPtus: result.deployedPtus,
      paygoCost: result.paygoCost,
      ptuCost: result.ptuCost,
    });
  });

  it("rejects overlapping cached and cache-write input tokens", () => {
    expect(() => calculateScenario(scenario(selectedModel, { cacheHitRate: 50, cacheWriteTokens: 501 })))
      .toThrow("Cache reads and writes cannot exceed total input tokens.");
  });
});

describe("normalized model catalog configuration", () => {
  it("loads both new dated entries with the current catalog verification", () => {
    expect(isCatalogDocument(bundledCatalog)).toBe(true);
    expect(astra["model name"]).toBe("azure openai gpt-6-astra (2026-09-03)");
    expect(image["model name"]).toBe("azure openai gpt-image-2 (2026-04-21)");
    expect(bundledCatalog.metadata["verified date"]).toBe("2026-09-29");
    expect(astra["input TPM per PTU"]).toBe(600);
    expect(astra["long context"]?.["output token multiple ratio"]).toBe(10);
    expect(image["input TPM per PTU"]).toBe(1200);
    expect(image["image input TPM per PTU"]).toBe(750);
    expect(image["image output-to-input ratio"]).toBe(3.75);
  });

  it.each([
    { "PTU input token weights": { uncached: 1, cached: -1, cacheWrite: 1.25 } },
    { "PTU input token weights": "invalid" },
    { "long context": {} },
    { "long context": { ...astra["long context"], "output token multiple ratio": 0 } },
    { "cache write token price per 1k": undefined },
  ])("rejects invalid Astra fields: %j", (changes) => {
    expect(isCatalogDocument({
      ...bundledCatalog,
      models: [{ ...astra, ...changes }],
    })).toBe(false);
  });

  it.each([
    { "image input TPM per PTU": 0 },
    { "image output-to-input ratio": "3.75" },
    { "image input token price per 1k": undefined },
  ])("rejects incomplete image configuration: %j", (changes) => {
    expect(isCatalogDocument({
      ...bundledCatalog,
      models: [{ ...image, ...changes }],
    })).toBe(false);
  });

  it("does not enable normalized cache accounting for existing models", () => {
    for (const entry of bundledCatalog.models.filter((item) => ![astra, image, sol, sol61].includes(item))) {
      expect(entry["PTU input token weights"]).toBeUndefined();
      expect(entry["long context"]).toBeUndefined();
      expect(entry["image input TPM per PTU"]).toBeUndefined();
    }
    const result = calculateScenario(scenario(model("gpt-5.6-luna"), {
      cacheHitRate: 100,
      outputTokens: 0,
    }));
    expect(result.normalizedTpm).toBe(0);
    expect(result.contextMode).toBeUndefined();
    expect(result.paygoBreakdown.cacheWriteCost).toBeUndefined();
  });
});
