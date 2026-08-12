import { describe, expect, it } from "vitest";
import { bundledCatalog } from "../data/catalog";
import type { ModelConfig } from "../types";
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

  it("uses the scale increment when pricing PTUs", () => {
    expect(calculatePtuCost(16, 15, 5, 260, 0).discountedCost).toBe(5200);
  });

  it("calculates Azure high-detail image tiles", () => {
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
    expect(result.paygoBreakdown.imageCost).toBeCloseTo(
      (2833 * MINUTES_PER_MONTH * 0.00015) / 1000,
    );
    expect(result.paygoCost).toBe(result.paygoBreakdown.imageCost);
  });

  it("includes Google per-image charges in PayGO cost", () => {
    const result = calculateScenario({
      model: model("google gemini-1.5 pro"),
      inputTextTokens: 1000,
      outputTokens: 0,
      rpm: 1,
      cacheHitRate: 0,
      images: [{ id: "image", width: 1024, height: 768, quality: "low" }],
      commitmentType: "Monthly",
      deploymentType: "Global / Data Zone",
    });

    expect(result.paygoBreakdown.imageCost).toBeCloseTo(
      MINUTES_PER_MONTH * 0.00032875,
    );
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

    expect(result.requiredPtus).toBeCloseTo(4171);
    expect(result.deployedPtus).toBe(4200);
    expect(result.normalizedTpm).toBeCloseTo(1_251_300);
    expect(
      result.explanation.steps.find(
        (step) => step.output === "Required PTU Num",
      )?.formula,
    ).toContain("normalized TPM");
  });

  it("keeps non-GLM Fireworks sizing manual", () => {
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

    expect(result.requiredPtus).toBe(401);
    expect(result.deployedPtus).toBe(600);
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

  it("keeps manually sized PTU cost fixed across the optimization curve", () => {
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

  it("ships the verified current model catalog", () => {
    const modelNames = new Set(
      bundledCatalog.models.map((item) => item["model name"]),
    );
    const glm52 = model("fireworks GLM 5.2");

    expect(bundledCatalog.metadata["verified date"]).toBe("2026-08-12");
    expect(modelNames.has("azure openai gpt-5.6-luna (2026-07-09)")).toBe(true);
    expect(modelNames.has("azure openai o4-mini (2025-04-16)")).toBe(true);
    expect(modelNames.has("fireworks DeepSeek v3.2")).toBe(true);
    expect(modelNames.has("fireworks MiniMax M3")).toBe(true);
    expect(glm52["PTU price of monthly commitment"]).toBe(260);
    expect(glm52["PTU price of yearly commitment"]).toBe(221);
  });
});
