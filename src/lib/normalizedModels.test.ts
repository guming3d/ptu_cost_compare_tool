import { describe, expect, it } from "vitest";
import { bundledCatalog, isCatalogDocument } from "../data/catalog";
import type { ContextMode, DeploymentType, ModelConfig, ScenarioInput } from "../types";
import {
  calculateAutomaticCacheWriteTokens,
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
const image = model("gpt-image-2 (");
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

describe("automatic cache-write estimates", () => {
  it.each([
    [3500, 90, 350],
    [3500, 0, 3500],
    [3500, 100, 0],
    [0, 90, 0],
    [31, 90, 3.1],
    [101, 67, 33.33],
  ])("estimates %s input tokens at %s%% cache hit as %s writes", (inputTokens, cacheHitRate, expected) => {
    expect(calculateAutomaticCacheWriteTokens(inputTokens, cacheHitRate)).toBe(expected);
  });

  it.each(["gpt-6-astra", "gpt-6-sol", "gpt-6.1-sol"])(
    "uses disjoint cache buckets for automatic writes on %s at every cache-hit rate",
    (name) => {
      const selectedModel = model(name);
      for (const contextMode of ["short", "long"] satisfies ContextMode[]) {
        for (let cacheHitRate = 0; cacheHitRate <= 100; cacheHitRate += 1) {
          const cacheWriteTokens = calculateAutomaticCacheWriteTokens(101, cacheHitRate);
          const result = calculateScenario(scenario(selectedModel, {
            inputTextTokens: 101,
            cacheHitRate,
            cacheWriteTokens,
            contextMode,
            outputTokens: 0,
            rpm: 1,
          }));
          const tier = contextMode === "long" ? selectedModel["long context"]! : selectedModel;
          const weights = tier["PTU input token weights"]!;
          const cachedTokens = 101 - cacheWriteTokens;
          expect(result.cacheWriteTokens).toBe(cacheWriteTokens);
          expect(result.paygoBreakdown?.nonCachedInputCost).toBe(0);
          expect(result.normalizedTpm).toBeCloseTo(
            cachedTokens * weights.cached + cacheWriteTokens * weights.cacheWrite,
          );
          expect(result.paygoBreakdown?.cacheWriteCost).toBeCloseTo(
            cacheWriteTokens / 1000 * MINUTES_PER_MONTH * tier["cache write token price per 1k"]!,
          );
          expect(result.explanation.inputs.cacheWriteTokens).toBe(cacheWriteTokens);
          expect(result.explanation.steps.find((step) => step.output === "Monthly PayGO input cost")?.substitution)
            .toMatch(/^\(0 x /);
        }
      }
    },
  );
});

describe("GPT-6 Astra normalized token accounting", () => {
  it.each([
    ["short", 0, 0, 0, 1000],
    ["short", 100, 0, 0, 100],
    ["short", 0, 1000, 0, 1250],
    ["short", 0, 0, 1000, 6000],
    ["long", 0, 0, 0, 2000],
    ["long", 100, 0, 0, 200],
    ["long", 0, 1000, 0, 2500],
    ["long", 0, 0, 1000, 9500],
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
    ["long", 19500, 35, 0.0195, 0.005, 7.5],
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
      expect(result.paygoBreakdown?.cacheWriteCost).toBeCloseTo(
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
      expect(inputStep?.result).toBe(result.paygoBreakdown?.inputCost);
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
    expect(result.paygoBreakdown?.nonCachedInputCost).toBe(0);
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
      expect(result.paygoBreakdown?.imageCost).toBeCloseTo(
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
    expect(result.paygoBreakdown?.cachedInputCost).toBeCloseTo(
      (2000 * 0.00125 / 1000) * 10 * MINUTES_PER_MONTH,
    );
    expect(result.paygoBreakdown?.nonCachedInputCost).toBe(0);
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
  { name: "gpt-6-sol", version: "2026-09-22", selectedModel: sol, shortCachePrice: 0.0002, shortCacheWeight: 0.1, longCachePrice: 0.0004, longCacheWeight: 0.2 },
  { name: "gpt-6.1-sol", version: "2026-09-29", selectedModel: sol61, shortCachePrice: 0.0001, shortCacheWeight: 0.05, longCachePrice: 0.0002, longCacheWeight: 0.1 },
])("$name published normalized sizing", ({ name, version, selectedModel, shortCachePrice, shortCacheWeight, longCachePrice, longCacheWeight }) => {
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
      "PTU input token weights": { uncached: 1, cached: shortCacheWeight, cacheWrite: 1.25 },
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
    ["short", 1000, 100, 0, 0, 1000 * shortCacheWeight],
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
    const normalizedPerRequest = isLong
      ? 1850 + 500 * longCacheWeight : 1050 + 500 * shortCacheWeight;
    const costPerRequest = isLong
      ? (300 * 0.004 + 500 * longCachePrice + 200 * 0.005 + 100 * 0.015) / 1000
      : (300 * 0.002 + 500 * shortCachePrice + 200 * 0.0025 + 100 * 0.01) / 1000;
    expect(result.normalizedTpm).toBeCloseTo(normalizedPerRequest * 100);
    expect(result.requiredPtus).toBeCloseTo(normalizedPerRequest * 100 / 3000);
    expect(result.deployedPtus).toBe(isLong ? 65 : 40);
    expect(result.ptuCost).toBe((isLong ? 65 : 40) * 260);
    expect(result.paygoCost).toBeCloseTo(costPerRequest * 100 * MINUTES_PER_MONTH);
    expect(result.paygoBreakdown?.cacheWriteCost).toBeCloseTo(
      200 * (isLong ? 0.005 : 0.0025) / 1000 * 100 * MINUTES_PER_MONTH,
    );
    expect(result.explanation.inputs).toMatchObject({
      contextMode,
      cacheWriteTokens: 200,
      cachedInputWeight: isLong ? longCacheWeight : shortCacheWeight,
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
    expect(result.normalizedTpm).toBe(10000 * shortCacheWeight);
    expect(result.paygoBreakdown?.cachedInputCost).toBeCloseTo(shortCachePrice * 10 * MINUTES_PER_MONTH);
    expect(result.paygoBreakdown?.nonCachedInputCost).toBe(0);
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
    expect(bundledCatalog.metadata["verified date"]).toBe("2026-10-28");
    expect(astra["input TPM per PTU"]).toBe(600);
    expect(astra["long context"]?.["output token multiple ratio"]).toBe(7.5);
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
    for (const entry of bundledCatalog.models.filter((item) => ![astra, image, sol, sol61].includes(item) && !item["model name"].includes("gpt-image-2.5-flare"))) {
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
    expect(result.tokenNormalization).toBeUndefined();
    expect(result.paygoBreakdown).not.toBeNull();
    expect(result.paygoBreakdown?.cacheWriteCost).toBeUndefined();
  });

  describe("shared normalization breakdown", () => {
    it.each(["gpt-6-astra", "gpt-6-sol", "gpt-6.1-sol"])(
      "matches the guide's short-context price baseline for every %s category",
      (name) => {
        const selectedModel = model(name);
        for (const contextMode of ["short", "long"] satisfies ContextMode[]) {
          const tier = contextMode === "long" ? selectedModel["long context"] : selectedModel;
          const weights = tier?.["PTU input token weights"];
          if (!tier || !weights || tier["cache write token price per 1k"] === undefined ||
              tier["input token price per 1k"] === null ||
              tier["input token price per 1k with cache hit"] === null ||
              tier["output token price per 1k"] === null) {
            throw new Error(`Missing normalized pricing tier: ${name} ${contextMode}`);
          }
          const baseline = selectedModel["input token price per 1k"];
          if (baseline === null) {
            throw new Error(`Missing baseline price: ${name}`);
          }
          expect(weights.uncached).toBeCloseTo(tier["input token price per 1k"] / baseline, 10);
          expect(weights.cached).toBeCloseTo(tier["input token price per 1k with cache hit"] / baseline, 10);
          expect(weights.cacheWrite).toBeCloseTo(tier["cache write token price per 1k"] / baseline, 10);
          expect(tier["output token multiple ratio"]).toBeCloseTo(tier["output token price per 1k"] / baseline, 10);
        }
      },
    );

    it("reproduces the GPT-6.1 short-context 90%-cache conversion without double counting", () => {
      const result = calculateScenario(scenario(sol61, {
        inputTextTokens: 3500,
        cacheHitRate: 90,
        cacheWriteTokens: 350,
        outputTokens: 300,
        rpm: 60,
      }));
      expect(result.tokenNormalization).toEqual({
        buckets: [
          { category: "uncached", tokens: 0, weight: 1, normalizedTokens: 0 },
          { category: "cached", tokens: 3150, weight: 0.05, normalizedTokens: 157.5 },
          { category: "cacheWrite", tokens: 350, weight: 1.25, normalizedTokens: 437.5 },
          { category: "output", tokens: 300, weight: 5, normalizedTokens: 1500 },
        ],
        normalizedTokensPerRequest: 2095,
      });
      expect(result.normalizedTpm).toBe(125700);
      expect(result.requiredPtus).toBe(41.9);
      expect(result.deployedPtus).toBe(45);
      expect(result.explanation.inputs.cachedInputWeight).toBe(0.05);
    });

    it.each(["gpt-6-astra", "gpt-6-sol", "gpt-6.1-sol"])(
      "keeps the %s visualization and PTU calculation consistent with manual writes and zero RPM",
      (name) => {
        for (const contextMode of ["short", "long"] satisfies ContextMode[]) {
          for (const rpm of [0, 60]) {
            const result = calculateScenario(scenario(model(name), {
              inputTextTokens: 3500,
              cacheHitRate: 90,
              cacheWriteTokens: 100,
              outputTokens: 300,
              rpm,
              contextMode,
            }));
            const breakdown = result.tokenNormalization;
            if (!breakdown) {
              throw new Error("Missing normalization breakdown");
            }
            expect(breakdown.buckets.slice(0, 3).map((bucket) => bucket.tokens))
              .toEqual([250, 3150, 100]);
            const weightedTotal = breakdown.buckets.reduce(
              (sum, bucket) => sum + bucket.tokens * bucket.weight, 0,
            );
            expect(breakdown.normalizedTokensPerRequest).toBe(weightedTotal);
            expect(result.normalizedTpm).toBe(weightedTotal * rpm);
            expect(result.explanation.steps.find((step) => step.output === "Normalized TPM")?.result)
              .toBe(result.normalizedTpm);
          }
        }
      },
    );
  });
});
