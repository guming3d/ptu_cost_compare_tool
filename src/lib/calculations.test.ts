import { describe, expect, it } from "vitest";
import { bundledCatalog } from "../data/catalog";
import type { ModelConfig } from "../types";
import {
  calculateGpt4oImageTokens,
  calculateProvisionedPtuNum,
  calculatePtuCost,
  calculateScenario,
  roundUpPtus,
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
  });

  it("keeps Fireworks sizing manual and rounds the deployment", () => {
    const result = calculateScenario({
      model: model("fireworks GLM 5.2"),
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
    expect(
      result.explanation.steps.find(
        (step) => step.output === "Required PTU Num",
      )?.formula,
    ).toContain("user supplied");
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
