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

describe("normalized model catalog configuration", () => {
  it("loads both new dated entries without changing catalog-wide verification", () => {
    expect(isCatalogDocument(bundledCatalog)).toBe(true);
    expect(astra["model name"]).toBe("azure openai gpt-6-astra (2026-09-03)");
    expect(image["model name"]).toBe("azure openai gpt-image-2 (2026-04-21)");
    expect(bundledCatalog.metadata["verified date"]).toBe("2026-08-29");
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
    for (const entry of bundledCatalog.models.filter((item) => item !== astra && item !== image)) {
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
