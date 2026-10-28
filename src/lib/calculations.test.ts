import { describe, expect, it } from "vitest";
import { bundledCatalog, isCatalogDocument } from "../data/catalog";
import type { ModelConfig, ScenarioInput } from "../types";
import {
  calculateAzureImageTokens,
  calculateCostOptimization,
  calculateGpt4oImageTokens,
  calculateProvisionedPtuNum,
  calculatePtuCost,
  calculateScenario,
  MINUTES_PER_MONTH,
  roundUpPtus,
  supportsAzureImageInput,
} from "./calculations";

function model(name: string): ModelConfig {
  const found = bundledCatalog.models.find((item) => item["model name"] === name);
  if (!found) {
    throw new Error(`Missing test model: ${name}`);
  }
  return found;
}

describe("PTU calculations", () => {
  it("rounds to the scale increment after applying the minimum", () => {
    expect(roundUpPtus(16, 15, 5)).toBe(20);
    expect(roundUpPtus(3, 15, 5)).toBe(15);
  });

  it("reproduces the documented GPT-5.2 workload", () => {
    const result = calculateProvisionedPtuNum(
      200,
      0,
      20,
      1000,
      15,
      5,
      3400,
      8,
    );

    expect(result.requiredPtus).toBeCloseTo(105.8823529);
    expect(result.deployedPtus).toBe(110);
    expect(result.metrics.totalInputTpm).toBe(200_000);
    expect(result.metrics.totalOutputTpm).toBe(20_000);
    expect(result.metrics.normalizedTpm).toBe(360_000);
  });

  it("removes cached text tokens from Azure PTU capacity", () => {
    const result = calculateProvisionedPtuNum(
      200,
      0,
      20,
      1000,
      15,
      5,
      3400,
      8,
      50,
    );

    expect(result.requiredPtus).toBeCloseTo(76.4705882);
    expect(result.deployedPtus).toBe(80);
  });

  it.each([
    ["Global / Data Zone", 980],
    ["Regional", 1000],
  ] as const)(
    "uses the GPT-5.4-mini 8:1 PTU override for %s without changing PayGO",
    (deploymentType, deployedPtus) => {
      const selectedModel = model("azure openai gpt-5.4-mini (2026-03-17)");
      const input = {
        model: selectedModel,
        inputTextTokens: 14_001,
        outputTokens: 79,
        rpm: 7350,
        cacheHitRate: 97,
        images: [],
        commitmentType: "Monthly" as const,
        deploymentType,
      };
      const result = calculateScenario(input);
      const previousRatioResult = calculateScenario({
        ...input,
        model: { ...selectedModel, "output token multiple ratio": 6 },
      });

      expect(selectedModel["output token multiple ratio"]).toBe(8);
      expect(result.normalizedTpm).toBeCloseTo(7_732_420.5);
      expect(result.requiredPtus).toBeCloseTo(978.7874050632912);
      expect(result.deployedPtus).toBe(deployedPtus);
      expect(result.ptuCost).toBe(deployedPtus * 260);
      expect(result.paygoCost).toBe(previousRatioResult.paygoCost);
      expect(
        model("azure openai gpt-5.4 (2026-03-05)")["output token multiple ratio"],
      ).toBe(6);
    },
  );

  it("uses the scale increment when pricing PTUs", () => {
    expect(calculatePtuCost(16, 15, 5, 260, 0).discountedCost).toBe(5200);
  });

  it("calculates Azure high-detail image tiles", () => {
    expect(calculateGpt4oImageTokens(512, 512, "high")).toBe(255);
    expect(calculateGpt4oImageTokens(1024, 1024, "high")).toBe(765);
    expect(calculateGpt4oImageTokens(2048, 4096, "high")).toBe(1105);
    expect(calculateGpt4oImageTokens(4096, 8192, "low")).toBe(85);
    expect(
      calculateAzureImageTokens(
        "azure openai GPT-4o-mini",
        1024,
        768,
        "low",
      ),
    ).toBe(2833);
    expect(
      calculateAzureImageTokens(
        "azure openai gpt-4.1-mini",
        64,
        64,
        "low",
      ),
    ).toBe(7);
    expect(
      calculateAzureImageTokens(
        "azure openai gpt-4.1-mini",
        255,
        7983,
        "high",
      ),
    ).toBe(
      calculateAzureImageTokens(
        "azure openai gpt-4.1-mini",
        7983,
        255,
        "high",
      ),
    );
    expect(calculateAzureImageTokens("azure openai o3", 1024, 1024, "high")).toBe(
      675,
    );
    expect(calculateAzureImageTokens("azure openai o3", 512, 512, "high")).toBe(
      225,
    );
    expect(supportsAzureImageInput("azure openai o1")).toBe(true);
    expect(supportsAzureImageInput("azure openai o3-mini")).toBe(false);
  });

  it("includes Azure image input tokens in PayGO cost", () => {
    const result = calculateScenario({
      model: model("azure openai GPT-4o-mini"),
      inputTextTokens: 0,
      outputTokens: 0,
      rpm: 1,
      cacheHitRate: 0,
      images: [{ id: "image", width: 1024, height: 768, quality: "low" }],
      commitmentType: "Monthly",
      deploymentType: "Global / Data Zone",
    });

    expect(result.inputImageTokens).toBe(2833);
    expect(result.paygoBreakdown?.imageCost).toBeCloseTo(
      (2833 * MINUTES_PER_MONTH * 0.00015) / 1000,
    );
    expect(result.paygoCost).toBe(result.paygoBreakdown?.imageCost);
  });

  it("estimates Fireworks GLM sizing with a 1:1 token ratio", () => {
    const result = calculateScenario({
      model: model("fireworks GLM 5.2"),
      inputTextTokens: 114_000,
      outputTokens: 2253,
      rpm: 100,
      cacheHitRate: 91,
      images: [],
      commitmentType: "Monthly",
      deploymentType: "Global / Data Zone",
    });

    expect(result.requiredPtus).toBeCloseTo(3850.153846);
    expect(result.deployedPtus).toBe(4000);
    expect(result.normalizedTpm).toBeCloseTo(1_251_300);
    expect(
      result.explanation.steps.find(
        (step) => step.output === "Required PTU Num",
      )?.formula,
    ).toContain("normalized TPM");
  });

  it("estimates Fireworks DeepSeek sizing with a 4:1 ratio", () => {
    const result = calculateScenario({
      model: model("fireworks DeepSeek V4 Pro"),
      inputTextTokens: 3500,
      outputTokens: 300,
      rpm: 60,
      cacheHitRate: 10,
      images: [],
      commitmentType: "Monthly",
      deploymentType: "Global / Data Zone",
      manualRequiredPtus: 401,
    });

    // 60 x 3,150 + 4 x 60 x 300 = 261,000 normalized TPM / 100 per PTU.
    expect(result.normalizedTpm).toBeCloseTo(261_000);
    expect(result.requiredPtus).toBeCloseTo(2610);
    expect(result.deployedPtus).toBe(2800);
    expect(
      result.explanation.steps.find((step) => step.output === "Normalized TPM")
        ?.note,
    ).toContain("Fireworks");
  });

  it("uses the PTU override instead of the automatic Fireworks estimate", () => {
    const result = calculateScenario({
      model: model("fireworks DeepSeek V4 Pro"),
      inputTextTokens: 3500,
      outputTokens: 300,
      rpm: 60,
      cacheHitRate: 10,
      images: [],
      commitmentType: "Monthly",
      deploymentType: "Global / Data Zone",
      manualRequiredPtus: 401,
      ptuOverride: true,
    });
    const requiredStep = result.explanation.steps.find(
      (step) => step.output === "Required PTU Num",
    );

    expect(result.requiredPtus).toBe(401);
    expect(result.deployedPtus).toBe(800);
    expect(result.normalizedTpm).toBeCloseTo(261_000);
    expect(requiredStep?.formula).toBe(
      "Required PTUs = user supplied PTU override",
    );
    expect(requiredStep?.substitution).toContain("2610.0000");
  });

  it("keeps catalog-manual Fireworks sizing manual", () => {
    const result = calculateScenario({
      model: { ...model("fireworks DeepSeek V4 Pro"), "PTU sizing mode": "manual" },
      inputTextTokens: 3500,
      outputTokens: 300,
      rpm: 60,
      cacheHitRate: 10,
      images: [],
      commitmentType: "Monthly",
      deploymentType: "Global / Data Zone",
      manualRequiredPtus: 401,
    });

    expect(result.requiredPtus).toBe(401);
    expect(result.deployedPtus).toBe(800);
  });

  it("finds the lowest-cost PTU configuration and builds comparable curves", () => {
    const optimization = calculateCostOptimization({
      model: model("azure openai gpt-5.2 (2025-12-11)"),
      inputTextTokens: 3500,
      outputTokens: 300,
      rpm: 60,
      cacheHitRate: 0,
      images: [],
      commitmentType: "Monthly",
      deploymentType: "Regional",
    });

    expect(optimization.configurations).toHaveLength(4);
    expect(optimization.bestConfiguration.commitmentType).toBe("Yearly");
    expect(optimization.bestConfiguration.deploymentType).toBe(
      "Global / Data Zone",
    );
    expect(
      optimization.bestConfiguration.points.some((point) => point.rpm === 60),
    ).toBe(true);
    expect(
      new Set(
        optimization.configurations.map(
          (configuration) => configuration.current.paygoCost,
        ),
      ).size,
    ).toBe(1);
    expect(optimization.bestConfiguration.breakEvenRpm).toBeGreaterThan(0);
  });

  it("keeps overridden PTU cost fixed across the optimization curve", () => {
    const optimization = calculateCostOptimization({
      model: model("fireworks DeepSeek V4 Pro"),
      inputTextTokens: 3500,
      outputTokens: 300,
      rpm: 60,
      cacheHitRate: 0,
      images: [],
      commitmentType: "Monthly",
      deploymentType: "Global / Data Zone",
      manualRequiredPtus: 401,
      ptuOverride: true,
    });

    expect(optimization.configurations).toHaveLength(2);
    expect(
      new Set(
        optimization.bestConfiguration.points.map((point) => point.ptuCost),
      ).size,
    ).toBe(1);
  });

  it("calculates break-even independently of a large chart range", () => {
    const optimization = calculateCostOptimization({
      model: model("azure openai gpt-5.6-luna (2026-07-09)"),
      inputTextTokens: 3500,
      outputTokens: 300,
      rpm: 1_000_000,
      cacheHitRate: 0,
      images: [],
      commitmentType: "Monthly",
      deploymentType: "Global / Data Zone",
    });

    expect(optimization.bestConfiguration.breakEvenRpm).toBeLessThan(100);
    expect(
      optimization.bestConfiguration.points.some(
        (point) =>
          point.rpm === optimization.bestConfiguration.breakEvenRpm,
      ),
    ).toBe(true);
    const firstPtuCost = optimization.bestConfiguration.points[0].ptuCost;
    const firstCapacityIncrease =
      optimization.bestConfiguration.points.find(
        (point) => point.ptuCost > firstPtuCost,
      );
    expect(firstCapacityIncrease?.rpm).toBeLessThan(100);
  });

  it("uses the first positive deployable tier for regional break-even", () => {
    const optimization = calculateCostOptimization({
      model: model("azure openai o1"),
      inputTextTokens: 3500,
      outputTokens: 0,
      rpm: 20,
      cacheHitRate: 75,
      images: [],
      commitmentType: "Monthly",
      deploymentType: "Regional",
    });
    const regionalMonthly = optimization.configurations.find(
      (configuration) =>
        configuration.commitmentType === "Monthly" &&
        configuration.deploymentType === "Regional",
    );
    const breakEvenPoint = regionalMonthly?.points.find(
      (point) => point.rpm === regionalMonthly.breakEvenRpm,
    );

    expect(regionalMonthly?.breakEvenRpm).toBeGreaterThan(0);
    expect(breakEvenPoint?.deployedPtus).toBe(50);
    expect(breakEvenPoint?.paygoCost).toBeCloseTo(
      breakEvenPoint?.ptuCost ?? 0,
    );
  });

  it("ships the verified current model catalog", () => {
    const modelNames = new Set(
      bundledCatalog.models.map((item) => item["model name"]),
    );
    const gpt56Luna = model("azure openai gpt-5.6-luna (2026-07-09)");
    const gpt56Terra = model("azure openai gpt-5.6-terra (2026-07-09)");
    const gpt56Sol = model("azure openai gpt-5.6-sol (2026-07-09)");
    const glm52 = model("fireworks GLM 5.2");

    expect(bundledCatalog.metadata["verified date"]).toBe("2026-10-28");
    expect(modelNames.has("azure openai gpt-5.6-luna (2026-07-09)")).toBe(true);
    expect(modelNames.has("azure openai o4-mini (2025-04-16)")).toBe(true);
    expect(modelNames.has("fireworks DeepSeek v3.2")).toBe(true);
    expect(modelNames.has("fireworks MiniMax M3")).toBe(true);
    expect(gpt56Luna["input token price per 1k"]).toBe(0.0002);
    expect(gpt56Luna["input token price per 1k with cache hit"]).toBe(0.00002);
    expect(gpt56Luna["cache write token price per 1k"]).toBe(0.00025);
    expect(gpt56Luna["output token price per 1k"]).toBe(0.0012);
    expect(gpt56Luna["input TPM per PTU"]).toBe(30_000);
    expect(gpt56Terra["input token price per 1k"]).toBe(0.002);
    expect(gpt56Terra["input token price per 1k with cache hit"]).toBe(0.0002);
    expect(gpt56Terra["cache write token price per 1k"]).toBe(0.0025);
    expect(gpt56Terra["output token price per 1k"]).toBe(0.012);
    expect(gpt56Terra["input TPM per PTU"]).toBe(3_000);
    expect(gpt56Sol["input token price per 1k"]).toBe(0.004);
    expect(gpt56Sol["input token price per 1k with cache hit"]).toBe(0.0004);
    expect(gpt56Sol["cache write token price per 1k"]).toBe(0.005);
    expect(gpt56Sol["output token price per 1k"]).toBe(0.02);
    expect(glm52["PTU price of monthly commitment"]).toBe(260);
    expect(glm52["PTU price of yearly commitment"]).toBe(221);
  });

  it("ships DeepSeek V4.1 Flash with supplied capacity and token prices", () => {
    const flash = model("fireworks DeepSeek V4.1 Flash");

    expect(isCatalogDocument(bundledCatalog)).toBe(true);
    expect(flash).toMatchObject({
      provider: "Fireworks on Microsoft Foundry",
      "input token price per 1k": 0.000375,
      "input token price per 1k with cache hit": 0.000008,
      "output token price per 1k": 0.0015,
      "PTU minumum deployment unit": 5,
      "PTU scale increment": 1,
      "input TPM per PTU": 11_000,
      "output token multiple ratio": 4,
      "PTU sizing mode": "automatic",
      "global provisioned only": true,
      "PTU price of monthly commitment": 260,
      "PTU price of yearly commitment": 221,
    });
  });

  it("rejects a non-boolean Global-only catalog setting", () => {
    expect(isCatalogDocument({
      ...bundledCatalog,
      models: [{
        ...model("fireworks DeepSeek V4.1 Flash"),
        "global provisioned only": "true",
      }],
    })).toBe(false);
  });

  it.each([
    [0, 5],
    [1, 5],
    [54_999, 5],
    [55_000, 5],
    [55_001, 6],
    [66_000, 6],
    [66_001, 7],
  ])("sizes V4.1 Flash input demand of %i TPM to %i PTUs", (inputTpm, deployedPtus) => {
    const result = calculateScenario({
      model: model("fireworks DeepSeek V4.1 Flash"),
      inputTextTokens: inputTpm,
      outputTokens: 0,
      rpm: 1,
      cacheHitRate: 0,
      images: [],
      commitmentType: "Monthly",
      deploymentType: "Global / Data Zone",
    });

    expect(result.normalizedTpm).toBe(inputTpm);
    expect(result.requiredPtus).toBeCloseTo(inputTpm / 11_000);
    expect(result.deployedPtus).toBe(deployedPtus);
    expect(result.ptuCost).toBe(deployedPtus * 260);
    expect(result.deploymentType).toBe("Global");
  });

  it.each([
    [0, 282_000, 26],
    [10, 261_000, 24],
    [100, 72_000, 7],
  ])("applies V4.1 Flash caching and output weighting at %i%% cache hit", (cacheHitRate, normalizedTpm, deployedPtus) => {
    const result = calculateScenario({
      model: model("fireworks DeepSeek V4.1 Flash"),
      inputTextTokens: 3500,
      outputTokens: 300,
      rpm: 60,
      cacheHitRate,
      images: [],
      commitmentType: "Monthly",
      deploymentType: "Global / Data Zone",
    });

    expect(result.normalizedTpm).toBeCloseTo(normalizedTpm);
    expect(result.requiredPtus).toBeCloseTo(normalizedTpm / 11_000);
    expect(result.deployedPtus).toBe(deployedPtus);
  });

  it.each([
    ["Monthly", 6240],
    ["Yearly", 5304],
  ] as const)("prices V4.1 Flash with %s commitment and explains Global capacity", (commitmentType, ptuCost) => {
    const result = calculateScenario({
      model: model("fireworks DeepSeek V4.1 Flash"),
      inputTextTokens: 3500,
      outputTokens: 300,
      rpm: 60,
      cacheHitRate: 10,
      images: [],
      commitmentType,
      deploymentType: "Global / Data Zone",
    });
    const monthlyRequests = 60 * MINUTES_PER_MONTH;

    expect(result.paygoBreakdown?.nonCachedInputCost).toBeCloseTo(monthlyRequests * 3150 * 0.375 / 1_000_000);
    expect(result.paygoBreakdown?.cachedInputCost).toBeCloseTo(monthlyRequests * 350 * 0.008 / 1_000_000);
    expect(result.paygoBreakdown?.outputCost).toBeCloseTo(monthlyRequests * 300 * 1.50 / 1_000_000);
    expect(result.paygoCost).toBeCloseTo(4294.7540064);
    expect(result.ptuCost).toBe(ptuCost);
    expect(result.explanation.deploymentType).toBe("Global");
    expect(result.explanation.inputs).toMatchObject({
      minimumPtus: 5,
      scaleIncrement: 1,
      inputPricePer1k: 0.000375,
      cachedInputPricePer1k: 0.000008,
      outputPricePer1k: 0.0015,
    });
    expect(result.explanation.steps.find((step) => step.output === "Required PTU Num")?.substitution)
      .toBe("261000.00 / 11000 = 23.7273");
    expect(result.explanation.steps.find((step) => step.output === "PTU cost")?.note)
      .toBe(`${commitmentType} commitment; Global.`);
  });

  it("keeps V4.1 Flash overrides and optimization on the Global one-PTU tiers", () => {
    const input = {
      model: model("fireworks DeepSeek V4.1 Flash"),
      inputTextTokens: 3500,
      outputTokens: 300,
      rpm: 60,
      cacheHitRate: 10,
      images: [],
      commitmentType: "Monthly" as const,
      deploymentType: "Global / Data Zone" as const,
    };
    const optimization = calculateCostOptimization(input);

    expect(optimization.configurations).toHaveLength(2);
    expect(optimization.bestConfiguration.commitmentType).toBe("Yearly");
    for (const configuration of optimization.configurations) {
      const result = calculateScenario({ ...input, commitmentType: configuration.commitmentType });
      expect(configuration.deploymentType).toBe("Global");
      expect(configuration.current).toMatchObject({
        requiredPtus: result.requiredPtus,
        deployedPtus: 24,
        paygoCost: result.paygoCost,
        ptuCost: result.ptuCost,
      });
      expect(configuration.points[0].deployedPtus).toBe(5);
      expect(configuration.points.every((point) => Number.isInteger(point.deployedPtus))).toBe(true);
    }

    const overrideInput = { ...input, ptuOverride: true, manualRequiredPtus: 5.1 };
    const override = calculateScenario(overrideInput);
    expect(override.requiredPtus).toBe(5.1);
    expect(override.deployedPtus).toBe(6);
    expect(override.normalizedTpm).toBeCloseTo(261_000);
    expect(override.ptuCost).toBe(1560);
    for (const configuration of calculateCostOptimization(overrideInput).configurations) {
      expect(configuration.deploymentType).toBe("Global");
      expect(configuration.points.every((point) => point.deployedPtus === 6)).toBe(true);
    }
  });

  it("does not invent output weights for newly documented Fireworks models", () => {
    const fireworks = bundledCatalog.models.filter((item) =>
      item.provider.startsWith("Fireworks"),
    );

    expect(fireworks.length).toBeGreaterThan(0);
    for (const item of fireworks) {
      if (item["model name"].startsWith("FW-")) {
        expect(item["PTU sizing mode"], item["model name"]).toBe("manual");
        expect(item["output token multiple ratio"], item["model name"]).toBeUndefined();
      } else {
        expect(item["PTU sizing mode"], item["model name"]).toBe("automatic");
        expect(item["output token multiple ratio"]).toBeGreaterThan(0);
      }
    }
  });
});

describe("October official catalog refresh", () => {
  function workload(name: string, changes: Partial<ScenarioInput> = {}): ScenarioInput {
    return {
      model: model(name),
      inputTextTokens: 2000,
      outputTokens: 100,
      rpm: 10,
      cacheHitRate: 0,
      images: [],
      commitmentType: "Monthly",
      deploymentType: "Global / Data Zone",
      ...changes,
    };
  }

  it("removes unlisted models and keeps exact PTU identities separate from retired PayGO", () => {
    const names = bundledCatalog.models.map((entry) => entry["model name"]);
    expect(names).not.toContain("google gemini-1.5 pro");
    expect(names).not.toContain("google gemini-1.5 flash");
    expect(names).not.toContain("fireworks MiniMax M2.5");
    expect(names).not.toContain("fireworks DeepSeek V4 Flash 0731");
    const fireworks = bundledCatalog.models.filter((entry) => entry.provider.startsWith("Fireworks"));
    expect(new Set(fireworks.map((entry) => entry["catalog model id"])).size).toBe(39);
    const flash = calculateScenario(workload("FW-DeepSeek-V4-Flash", { manualRequiredPtus: 201 }));
    expect(flash.deployedPtus).toBe(300);
    expect(flash.explanation.inputs.inputTpmPerPtu).toBe(1400);
    expect(flash.paygoCost).toBeNull();
  });

  it.each([
    ["fireworks DeepSeek v3.2", 1080, 540, 833],
    ["fireworks DeepSeek V4 Pro", 800, 400, 100],
    ["fireworks MiniMax M3", 800, 400, 2650],
    ["fireworks Kimi K2.5", 720, 360, 294],
    ["fireworks Kimi K2.6", 400, 200, 2000],
    ["fireworks Kimi K2.7 Code", 400, 200, 1000],
    ["fireworks gpt-oss-120b", 50, 25, 10800],
    ["fireworks GLM 5", 1080, 540, 167],
    ["fireworks GLM 5.1", 720, 360, 500],
    ["fireworks GLM 5.2", 800, 400, 325],
  ] as const)("uses updated throughput and rounding for %s", (name, minimum, increment, tpm) => {
    const result = calculateScenario(workload(name, {
      inputTextTokens: (minimum + 1) * tpm,
      outputTokens: 0,
      rpm: 1,
    }));
    expect(result.requiredPtus).toBeCloseTo(minimum + 1);
    expect(result.deployedPtus).toBe(minimum + increment);
  });

  it("retains PTU calculations without current PayGO savings for retired offerings", () => {
    const input = workload("fireworks DeepSeek v3.2");
    const result = calculateScenario(input);
    expect(result.ptuCost).toBeGreaterThan(0);
    expect(result.paygoCost).toBeNull();
    expect(result.paygoBreakdown).toBeNull();
    expect(result.costSavingPercentage).toBeNull();
    expect(result.explanation.inputs.paygoRetirementDate).toBe("2026-06-01");
    expect(result.explanation.steps.find((step) => step.output === "PayGO cost")?.result).toBe("N/A");
    for (const curve of calculateCostOptimization(input).configurations) {
      expect(curve.current.savings).toBeNull();
      expect(curve.current.savingsPercentage).toBeNull();
      expect(curve.breakEvenRpm).toBeUndefined();
      expect(curve.points.every((point) => point.paygoCost === null)).toBe(true);
    }
  });

  it.each([undefined, 0, -1, Number.NaN])("requires a real benchmark instead of defaulting to minimum PTUs (%s)", (manualRequiredPtus) => {
    expect(() => calculateScenario(workload("FW-Gemma-4-31B-IT", { manualRequiredPtus })))
      .toThrow(/Benchmarked required PTUs/);
  });

  it.each([
    ["Global", 5, 1, 1645, 6, 0.00175],
    ["Data Zone", 320, 160, 1050, 480, 0.0021],
    ["Global (standard capacity)", 320, 160, 1050, 480, 0.00175],
  ] as const)("uses GLM 5.3 %s capacity and pricing independently", (deploymentType, minimum, increment, tpm, deployed, price) => {
    const input = workload("FW-GLM-5.3", { deploymentType, manualRequiredPtus: minimum + 0.1, outputTokens: 0 });
    const result = calculateScenario(input);
    expect(result.deploymentType).toBe(deploymentType);
    expect(result.deployedPtus).toBe(deployed);
    expect(result.explanation.inputs).toMatchObject({ minimumPtus: minimum, scaleIncrement: increment, inputTpmPerPtu: tpm });
    expect(result.paygoCost).toBeCloseTo(2000 / 1000 * price * 10 * MINUTES_PER_MONTH);
    const optimization = calculateCostOptimization(input);
    expect(optimization.configurations).toHaveLength(2);
    expect(optimization.configurations.every((curve) => curve.deploymentType === deploymentType)).toBe(true);
    expect(optimization.configurations[0].current.ptuCost).toBe(result.ptuCost);
  });

  it("uses configured TPM when a custom benchmark supplies a GLM 5.3 output weight", () => {
    const selectedModel = { ...model("FW-GLM-5.3"), "PTU sizing mode": "automatic", "output token multiple ratio": 1 };
    const input = workload("FW-GLM-5.3", { model: selectedModel, deploymentType: "Global" });
    const optimization = calculateCostOptimization(input);
    expect(optimization.configurations).toHaveLength(6);
    expect(optimization.configurations.find((curve) => curve.deploymentType === "Data Zone")?.current.requiredPtus).toBe(20);
    expect(optimization.configurations.find((curve) => curve.deploymentType === "Global")?.current.requiredPtus).toBeCloseTo(21000 / 1645);
  });

  it("sizes Flare with measured image tokens without copying image-2 prices", () => {
    const result = calculateScenario(workload("azure openai gpt-image-2.5-flare (2026-09-08)", {
      imageInputTokens: 1229,
      outputTokens: 7024,
    }));
    expect(result.normalizedTpm).toBeCloseTo(461104);
    expect(result.requiredPtus).toBeCloseTo(384.253333);
    expect(result.deployedPtus).toBe(400);
    expect(result.paygoCost).toBeNull();
    expect(result.costSavingPercentage).toBeNull();
    expect(result.explanation.inputs.imageInputPricePer1k).toBe("N/A");
  });

  it("uses Azure Llama's documented 4:1 output weight, not its 1:1 PayGO price ratio", () => {
    const input = workload("azure Llama-3.3-70B-Instruct", { inputTextTokens: 8450, outputTokens: 8450, rpm: 1 });
    const result = calculateScenario(input);
    expect(result.requiredPtus).toBe(5);
    expect(result.deployedPtus).toBe(100);
    expect(result.paygoCost).toBeCloseTo(16900 / 1000 * 0.00071 * MINUTES_PER_MONTH);
    expect(calculateScenario({ ...input, cacheHitRate: 50 }).paygoCost).toBeNull();
    expect(() => calculateScenario({ ...input, deploymentType: "Regional" })).toThrow(/does not support/);
  });

  it.each(["fireworks DeepSeek V4.1 Flash", "FW-Kimi-K3"])("rejects unsupported Data Zone capacity for %s", (name) => {
    expect(() => calculateScenario(workload(name, { deploymentType: "Data Zone", manualRequiredPtus: 5 })))
      .toThrow(/does not support/);
  });

  it.each([
    "azure openai gpt-5.4 (2026-03-05)",
    "azure openai gpt-4.1 (2025-04-14)",
    "azure openai gpt-4.1-mini (2025-04-14)",
    "azure openai gpt-4.1-nano (2025-04-14)",
  ])("enforces the provisioned 128K prompt limit before cache deductions for %s", (name) => {
    const input = workload(name, { inputTextTokens: 128000, cacheHitRate: 100 });
    expect(() => calculateScenario(input)).not.toThrow();
    expect(() => calculateScenario({ ...input, inputTextTokens: 128001 })).toThrow(/128,000/);
  });

  it.each([
    { "PayGO status": "unknown" },
    { "PayGO status": ["retired"] },
    { "PTU sizing mode": ["manual"] },
    { "input token price per 1k": -1 },
    { "PTU maximum prompt tokens": 0 },
    { "PTU deployments": {} },
    { "PTU deployments": { "Data Zone": { minimumPtus: 320, scaleIncrement: 160, inputTpmPerPtu: 0 } } },
    { "PTU deployments": { "Data Zone": { minimumPtus: 320, scaleIncrement: 160, inputTpmPerPtu: 1050, paygo: {} } } },
  ])("rejects malformed availability and variant configuration (%j)", (changes) => {
    expect(isCatalogDocument({
      ...bundledCatalog,
      models: [{ ...model("FW-GLM-5.3"), ...changes }],
    })).toBe(false);
  });
});
