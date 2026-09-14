import type {
  CalculationExplanation,
  CalculationStep,
  ComparisonResult,
  CostOptimization,
  CostBreakdown,
  CostCurvePoint,
  DeploymentType,
  ModelConfig,
  PtuConfigurationCurve,
  PtuMetrics,
  PtuInputTokenWeights,
  ScenarioInput,
} from "../types";

export const MONTH_DAYS = 30.42;
export const MINUTES_PER_MONTH = MONTH_DAYS * 24 * 60;

const DEFAULT_INPUT_WEIGHTS: PtuInputTokenWeights = {
  uncached: 1,
  cached: 0,
  cacheWrite: 1,
};

function requirePositive(value: number | undefined, label: string): number {
  if (value === undefined || !Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} must be a positive number.`);
  }
  return value;
}

function requireNonNegative(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${label} cannot be negative.`);
  }
}

export function roundUpPtus(
  requiredPtus: number,
  minimumPtus: number,
  scaleIncrement: number,
): number {
  requireNonNegative(requiredPtus, "Required PTUs");
  requirePositive(minimumPtus, "PTU minimum");
  requirePositive(scaleIncrement, "PTU scale increment");

  return Math.max(
    minimumPtus,
    Math.ceil(requiredPtus / scaleIncrement) * scaleIncrement,
  );
}

export function calculateGooglePtuNum(
  inputTextTokens: number,
  imageCount: number,
  outputTokens: number,
  rpm: number,
  outputTokenMultiplier: number,
  charsPerGsu: number,
  charsPerImageUnder128k: number,
  charsPerImageOver128k: number,
): number {
  const imageTokens =
    ((inputTextTokens <= 128_000
      ? charsPerImageUnder128k
      : charsPerImageOver128k) *
      imageCount) /
    4;

  return (
    ((inputTextTokens + imageTokens + outputTokens * outputTokenMultiplier) *
      4 *
      (rpm / 60)) /
    charsPerGsu
  );
}

export function calculateGpt4oImageTokens(
  width: number,
  height: number,
  detailLevel: "low" | "high",
): number {
  return calculateDetailImageTokens(width, height, detailLevel, 85, 170);
}

function calculateDetailImageTokens(
  width: number,
  height: number,
  detailLevel: "low" | "high",
  baseTokens: number,
  tokensPerTile: number,
): number {
  if (width <= 0 || height <= 0) {
    return 0;
  }
  if (detailLevel === "low") {
    return baseTokens;
  }

  const firstScale = Math.min(2048 / width, 2048 / height, 1);
  let resizedWidth = width * firstScale;
  let resizedHeight = height * firstScale;
  const shortestSide = Math.min(resizedWidth, resizedHeight);

  if (shortestSide > 768) {
    const secondScale = 768 / shortestSide;
    resizedWidth *= secondScale;
    resizedHeight *= secondScale;
  }

  const tiles =
    Math.ceil(resizedWidth / 512) * Math.ceil(resizedHeight / 512);
  return tiles * tokensPerTile + baseTokens;
}

function calculatePatchImageTokens(
  width: number,
  height: number,
  multiplier: number,
): number {
  const patchSize = 32;
  const patchCap = 1536;
  let widthPatches = Math.ceil(width / patchSize);
  let heightPatches = Math.ceil(height / patchSize);

  if (widthPatches * heightPatches > patchCap) {
    const widthPatchRatio = width / patchSize;
    const heightPatchRatio = height / patchSize;
    let low = 0;
    let high = 1;

    for (let iteration = 0; iteration < 50; iteration += 1) {
      const scale = (low + high) / 2;
      const scaledWidthPatches = Math.ceil(widthPatchRatio * scale);
      const scaledHeightPatches = Math.ceil(heightPatchRatio * scale);
      if (scaledWidthPatches * scaledHeightPatches <= patchCap) {
        low = scale;
      } else {
        high = scale;
      }
    }

    widthPatches = Math.ceil(widthPatchRatio * low);
    heightPatches = Math.ceil(heightPatchRatio * low);
  }

  return Math.ceil(widthPatches * heightPatches * multiplier);
}

export function calculateAzureImageTokens(
  modelName: string,
  width: number,
  height: number,
  detailLevel: "low" | "high",
): number {
  if (width <= 0 || height <= 0) {
    return 0;
  }

  const normalizedName = modelName.toLowerCase();
  if (normalizedName.includes("gpt-4.1-mini")) {
    return calculatePatchImageTokens(width, height, 1.62);
  }
  if (normalizedName.includes("gpt-4.1-nano")) {
    return calculatePatchImageTokens(width, height, 2.46);
  }
  if (normalizedName.includes("o4-mini")) {
    return calculatePatchImageTokens(width, height, 1.72);
  }
  if (normalizedName.includes("gpt-4o-mini")) {
    return calculateDetailImageTokens(
      width,
      height,
      detailLevel,
      2833,
      5667,
    );
  }
  if (
    /(?:^| )(?:o1|o3)(?: |$|\()/.test(normalizedName)
  ) {
    return calculateDetailImageTokens(
      width,
      height,
      detailLevel,
      75,
      150,
    );
  }

  return calculateGpt4oImageTokens(width, height, detailLevel);
}

export function supportsAzureImageInput(modelName: string): boolean {
  return /(?:^| )(?:gpt-4o(?:-mini)?|gpt-4\.1(?:-mini|-nano)?|o4-mini|o1|o3)(?: |$|\()/.test(
    modelName.toLowerCase(),
  );
}

export function usesImageTokenSizing(model: ModelConfig): boolean {
  return model["image input TPM per PTU"] !== undefined;
}

function getImageInputRatio(model: ModelConfig): number {
  return usesImageTokenSizing(model)
    ? requirePositive(model["input TPM per PTU"], "Input TPM per PTU") /
        requirePositive(model["image input TPM per PTU"], "Image input TPM per PTU")
    : 1;
}

function getOutputRatio(model: ModelConfig): number {
  return usesImageTokenSizing(model)
    ? getImageInputRatio(model) *
        requirePositive(model["image output-to-input ratio"], "Image output ratio")
    : requirePositive(model["output token multiple ratio"], "Output token ratio");
}

function getScenarioModel(input: ScenarioInput): ModelConfig {
  if (input.contextMode === "long") {
    if (!input.model["long context"]) {
      throw new Error("This model has no long-context configuration.");
    }
    return { ...input.model, ...input.model["long context"] };
  }
  return input.model;
}

function getInputTokenSplit(
  inputTokens: number,
  cacheHitRate: number,
  cacheWriteTokens: number,
) {
  if (!Number.isFinite(cacheHitRate) || cacheHitRate < 0 || cacheHitRate > 100) {
    throw new Error("Cache hit rate must be between 0 and 100.");
  }
  requireNonNegative(cacheWriteTokens, "Cache write tokens");
  const cachedTokens = inputTokens * (cacheHitRate / 100);
  const uncachedTokens = inputTokens - cachedTokens - cacheWriteTokens;
  if (uncachedTokens < 0) {
    throw new Error("Cache reads and writes cannot exceed total input tokens.");
  }
  return { cachedTokens, uncachedTokens, cacheWriteTokens };
}

export function calculateProvisionedPtuNum(
  inputTokens: number,
  imageInputTokens: number,
  outputTokens: number,
  peakCallsPerMinute: number,
  minimumPtus: number,
  scaleIncrement: number,
  inputTpmPerPtu: number,
  outputToInputRatio: number,
  cacheHitRate = 0,
  options: {
    inputWeights?: PtuInputTokenWeights;
    cacheWriteTokens?: number;
    imageInputRatio?: number;
  } = {},
): {
  requiredPtus: number;
  deployedPtus: number;
  metrics: PtuMetrics;
} {
  const weights = options.inputWeights ?? DEFAULT_INPUT_WEIGHTS;
  Object.entries(weights).forEach(([key, value]) =>
    requireNonNegative(value, `PTU input weight ${key}`),
  );
  const tokens = getInputTokenSplit(inputTokens, cacheHitRate, options.cacheWriteTokens ?? 0);
  if (tokens.cacheWriteTokens > 0 && !options.inputWeights) {
    throw new Error("Cache writes require configured PTU input token weights.");
  }
  const effectiveTextInput = options.inputWeights
    ? tokens.uncachedTokens * weights.uncached +
      tokens.cachedTokens * weights.cached +
      tokens.cacheWriteTokens * weights.cacheWrite
    : inputTokens * (1 - cacheHitRate / 100);
  const totalInputTpm =
    peakCallsPerMinute * (effectiveTextInput + imageInputTokens *
      requirePositive(options.imageInputRatio ?? 1, "Image input ratio"));
  const totalOutputTpm = peakCallsPerMinute * outputTokens;
  const normalizedTpm =
    totalInputTpm + totalOutputTpm * requirePositive(outputToInputRatio, "Output ratio");
  const requiredPtus =
    normalizedTpm / requirePositive(inputTpmPerPtu, "Input TPM per PTU");

  return {
    requiredPtus,
    deployedPtus: roundUpPtus(requiredPtus, minimumPtus, scaleIncrement),
    metrics: {
      effectiveTextInput,
      totalInputTpm,
      totalOutputTpm,
      normalizedTpm,
    },
  };
}

export function calculatePaygoCost(
  inputTokens: number,
  outputTokens: number,
  rpm: number,
  model: ModelConfig,
  cacheHitRate = 0,
  imageInputTokens = 0,
  imageCount = 0,
  cacheWriteTokens = 0,
): CostBreakdown {
  if (cacheHitRate < 0 || cacheHitRate > 100) {
    throw new Error("Cache hit rate must be between 0 and 100.");
  }
  requireNonNegative(imageInputTokens, "Image input tokens");
  requireNonNegative(imageCount, "Image count");

  const monthlyRequests = rpm * MINUTES_PER_MONTH;
  const { cachedTokens: cachedInputTokens, uncachedTokens: nonCachedInputTokens } =
    getInputTokenSplit(inputTokens, cacheHitRate, cacheWriteTokens);
  const cacheWriteCost = cacheWriteTokens > 0
    ? ((cacheWriteTokens * monthlyRequests) / 1000) *
      requirePositive(model["cache write token price per 1k"], "Cache write price")
    : 0;
  const nonCachedInputCost =
    ((nonCachedInputTokens * monthlyRequests) / 1000) *
    model["input token price per 1k"];
  const cachedInputCost =
    ((cachedInputTokens * monthlyRequests) / 1000) *
    model["input token price per 1k with cache hit"];
  const outputCost =
    ((outputTokens * monthlyRequests) / 1000) *
    model["output token price per 1k"];
  const imageTokenCost =
    ((imageInputTokens * monthlyRequests) / 1000) *
    (usesImageTokenSizing(model)
      ? requirePositive(model["image input token price per 1k"], "Image input price")
      : model["input token price per 1k"]);
  const imageUnitPrice =
    model.provider === "Google"
      ? inputTokens <= 128_000
        ? (model["price per image(<=128k input tokens)"] ?? 0)
        : (model["price per image(>128k input tokens)"] ?? 0)
      : 0;
  const imageCost =
    imageTokenCost + imageCount * monthlyRequests * imageUnitPrice;
  const inputCost = nonCachedInputCost + cachedInputCost + cacheWriteCost;

  return {
    nonCachedInputCost,
    cachedInputCost,
    inputCost,
    imageCost,
    outputCost,
    totalCost: inputCost + imageCost + outputCost,
    ...(model["PTU input token weights"] ? { cacheWriteCost } : {}),
  };
}

export function calculatePtuCost(
  requiredPtus: number,
  minimumPtus: number,
  scaleIncrement: number,
  ptuPricePerUnit: number,
  ptuDiscount: number,
): {
  deployedPtus: number;
  costBeforeDiscount: number;
  discountedCost: number;
} {
  const deployedPtus = roundUpPtus(
    requiredPtus,
    minimumPtus,
    scaleIncrement,
  );
  const costBeforeDiscount = deployedPtus * ptuPricePerUnit;

  return {
    deployedPtus,
    costBeforeDiscount,
    discountedCost: costBeforeDiscount * (1 - ptuDiscount),
  };
}

export function calculateTpmPerDollar(
  inputTextTokens: number,
  inputImageTokens: number,
  outputTokens: number,
  rpm: number,
  ptuCost: number,
): number {
  if (ptuCost <= 0) {
    return 0;
  }

  return (
    (((inputTextTokens + inputImageTokens + outputTokens) * rpm) /
      (ptuCost / MINUTES_PER_MONTH)) /
    1_000_000
  );
}

function getDeploymentCapacity(input: ScenarioInput): {
  minimumPtus: number;
  scaleIncrement: number;
  deploymentLabel: string;
} {
  const { model, deploymentType } = input;

  if (model.provider === "Azure OpenAI" && deploymentType === "Regional") {
    return {
      minimumPtus: requirePositive(
        model["regional PTU minimum deployment unit"],
        "Regional PTU minimum",
      ),
      scaleIncrement: requirePositive(
        model["regional PTU scale increment"],
        "Regional PTU scale increment",
      ),
      deploymentLabel: "Regional",
    };
  }

  return {
    minimumPtus: requirePositive(
      model["PTU minumum deployment unit"],
      "PTU minimum",
    ),
    scaleIncrement: requirePositive(
      model["PTU scale increment"],
      "PTU scale increment",
    ),
    deploymentLabel:
      model.provider === "Azure OpenAI"
        ? "Global / Data Zone"
        : "Configured default",
  };
}

function getCommitmentPricing(input: ScenarioInput): {
  pricePerUnit: number;
  discount: number;
} {
  if (input.commitmentType === "Yearly") {
    return {
      pricePerUnit: input.model["PTU price of yearly commitment"],
      discount: input.model["PTU yearly discount"],
    };
  }

  return {
    pricePerUnit: input.model["PTU price of monthly commitment"],
    discount: input.model["PTU monthly discount"],
  };
}

function calculateImageInputTokens(input: ScenarioInput): number {
  if (usesImageTokenSizing(input.model)) {
    const tokens = input.imageInputTokens ?? 0;
    requireNonNegative(tokens, "Image input tokens");
    return tokens;
  }
  const supportsAzureImageMetering =
    input.model.provider === "Azure OpenAI" &&
    supportsAzureImageInput(input.model["model name"]);

  if (!supportsAzureImageMetering) {
    return 0;
  }

  return input.images.reduce(
    (total, image) =>
      total +
      calculateAzureImageTokens(
        input.model["model name"],
        image.width,
        image.height,
        image.quality,
      ),
    0,
  );
}

function usesAutomaticProvisionedSizing(model: ModelConfig): boolean {
  return (
    model.provider === "Azure OpenAI" ||
    model["PTU sizing mode"] === "automatic"
  );
}

function buildExplanation(args: {
  input: ScenarioInput;
  inputImageTokens: number;
  requiredPtus: number;
  deployedPtus: number;
  minimumPtus: number;
  scaleIncrement: number;
  deploymentLabel: string;
  pricePerUnit: number;
  discount: number;
  ptuMetrics?: PtuMetrics;
  paygo: CostBreakdown;
  ptuCostBeforeDiscount: number;
  ptuCost: number;
  tpmPerDollar: number;
  costSavingPercentage: number;
}): CalculationExplanation {
  const {
    input,
    inputImageTokens,
    requiredPtus,
    deployedPtus,
    minimumPtus,
    scaleIncrement,
    deploymentLabel,
    pricePerUnit,
    discount,
    ptuMetrics,
    paygo,
    ptuCostBeforeDiscount,
    ptuCost,
    tpmPerDollar,
    costSavingPercentage,
  } = args;
  const model = getScenarioModel(input);
  const monthlyRequests = input.rpm * MINUTES_PER_MONTH;
  const cachedTokens = input.inputTextTokens * (input.cacheHitRate / 100);
  const cacheWriteTokens = input.cacheWriteTokens ?? 0;
  const nonCachedTokens = input.inputTextTokens - cachedTokens - cacheWriteTokens;
  const steps: CalculationStep[] = [
    {
      output: "Monthly requests",
      result: monthlyRequests,
      unit: "requests/month",
      formula: "Monthly requests = RPM x 60 x 24 x 30.42",
      substitution: `${input.rpm} x 60 x 24 x 30.42 = ${monthlyRequests.toLocaleString("en-US")}`,
    },
    {
      output: "Monthly PayGO input cost",
      result: paygo.inputCost,
      unit: "USD/month",
      formula:
        "(non-cached tokens x monthly requests / 1,000 x input price) + (cached tokens x monthly requests / 1,000 x cached price)",
      substitution: `(${nonCachedTokens.toLocaleString("en-US")} x ${monthlyRequests.toLocaleString("en-US")} / 1,000 x ${model["input token price per 1k"]}) + (${cachedTokens.toLocaleString("en-US")} x ${monthlyRequests.toLocaleString("en-US")} / 1,000 x ${model["input token price per 1k with cache hit"]}) = ${paygo.inputCost.toFixed(2)}`,
      note: `${input.inputTextTokens.toLocaleString("en-US")} input tokens per request at a ${input.cacheHitRate}% cache-hit rate.`,
    },
  ];

  if (model["PTU input token weights"]) {
    steps[1] = {
      output: "Monthly PayGO input cost",
      result: paygo.inputCost,
      unit: "USD/month",
      formula:
        "(uncached tokens x input price + cached tokens x cached price + cache write tokens x write price) x monthly requests / 1,000",
      substitution: `(${nonCachedTokens} x ${model["input token price per 1k"]} + ${cachedTokens} x ${model["input token price per 1k with cache hit"]} + ${cacheWriteTokens} x ${model["cache write token price per 1k"]}) x ${monthlyRequests} / 1,000 = ${paygo.inputCost.toFixed(2)}`,
    };
  }

  if (paygo.imageCost > 0) {
    const googleImagePrice =
      input.inputTextTokens <= 128_000
        ? model["price per image(<=128k input tokens)"]
        : model["price per image(>128k input tokens)"];
    const usesPerImagePricing =
      model.provider === "Google" && googleImagePrice !== undefined;

    steps.push({
      output: "Monthly PayGO image cost",
      result: paygo.imageCost,
      unit: "USD/month",
      formula: usesPerImagePricing
        ? "image count x monthly requests x image price"
        : "image input tokens x monthly requests / 1,000 x input price",
      substitution: usesPerImagePricing
        ? `${input.images.length} x ${monthlyRequests.toLocaleString("en-US")} x ${googleImagePrice} = ${paygo.imageCost.toFixed(2)}`
        : `${inputImageTokens.toLocaleString("en-US")} x ${monthlyRequests.toLocaleString("en-US")} / 1,000 x ${model["image input token price per 1k"] ?? model["input token price per 1k"]} = ${paygo.imageCost.toFixed(2)}`,
    });
  }

  steps.push(
    {
      output: "Monthly PayGO output cost",
      result: paygo.outputCost,
      unit: "USD/month",
      formula: "output tokens x monthly requests / 1,000 x output price",
      substitution: `${input.outputTokens.toLocaleString("en-US")} x ${monthlyRequests.toLocaleString("en-US")} / 1,000 x ${model["output token price per 1k"]} = ${paygo.outputCost.toFixed(2)}`,
    },
    {
      output: "PayGO cost",
      result: paygo.totalCost,
      unit: "USD/month",
      formula: "PayGO cost = input cost + image cost + output cost",
      substitution: `${paygo.inputCost.toFixed(2)} + ${paygo.imageCost.toFixed(2)} + ${paygo.outputCost.toFixed(2)} = ${paygo.totalCost.toFixed(2)}`,
    },
  );

  if (usesAutomaticProvisionedSizing(model)) {
    const metrics = ptuMetrics;
    if (!metrics) {
      throw new Error("Automatic PTU metrics are required for the explanation.");
    }
    const outputRatio = getOutputRatio(model);
    const imageInputRatio = getImageInputRatio(model);
    const weights = model["PTU input token weights"];
    const inputTpmPerPtu = requirePositive(
      model["input TPM per PTU"],
      "Input TPM per PTU",
    );

    steps.push(
      {
        output: "Effective text input tokens",
        result: metrics.effectiveTextInput,
        unit: "tokens/request",
        formula: weights
          ? "uncached tokens x input weight + cached tokens x cache weight + cache write tokens x write weight"
          : "input tokens x (1 - cache hit rate / 100)",
        substitution: weights
          ? `${nonCachedTokens} x ${weights.uncached} + ${cachedTokens} x ${weights.cached} + ${cacheWriteTokens} x ${weights.cacheWrite} = ${metrics.effectiveTextInput.toFixed(2)}`
          : `${input.inputTextTokens} x (1 - ${input.cacheHitRate} / 100) = ${metrics.effectiveTextInput.toFixed(2)}`,
      },
      {
        output: "Normalized TPM",
        result: metrics.normalizedTpm,
        unit: "normalized tokens/minute",
        formula: usesImageTokenSizing(model)
          ? "RPM x (effective text input + image input x image-to-text factor + image output x image output-to-input ratio x image-to-text factor)"
          : "RPM x (effective text input + image input) + output ratio x (RPM x output tokens)",
        substitution: usesImageTokenSizing(model)
          ? `${input.rpm} x (${metrics.effectiveTextInput.toFixed(2)} + ${inputImageTokens} x ${imageInputRatio} + ${input.outputTokens} x ${model["image output-to-input ratio"]} x ${imageInputRatio}) = ${metrics.normalizedTpm.toFixed(2)}`
          : `${input.rpm} x (${metrics.effectiveTextInput.toFixed(2)} + ${inputImageTokens}) + ${outputRatio} x (${input.rpm} x ${input.outputTokens}) = ${metrics.normalizedTpm.toFixed(2)}`,
      },
      {
        output: "Required PTU Num",
        result: requiredPtus,
        unit: "raw PTUs",
        formula: "normalized TPM / input TPM per PTU",
        substitution: `${metrics.normalizedTpm.toFixed(2)} / ${inputTpmPerPtu} = ${requiredPtus.toFixed(4)}`,
      },
    );
  } else if (model.provider === "Google") {
    const outputRatio = requirePositive(
      model["output token multiple ratio"],
      "Output token ratio",
    );
    const charsPerGsu = requirePositive(model["chars per GSU"], "Characters per GSU");
    const charsPerImage =
      input.inputTextTokens <= 128_000
        ? requirePositive(
            model["chars per image(<=128k input tokens)"],
            "Characters per image",
          )
        : requirePositive(
            model["chars per image(>128k input tokens)"],
            "Characters per image",
          );
    const estimatedImageTokens = (charsPerImage * input.images.length) / 4;

    steps.push({
      output: "Required PTU Num",
      result: requiredPtus,
      unit: "raw GSUs",
      formula:
        "(input tokens + image estimate + output ratio x output tokens) x 4 x (RPM / 60) / characters per GSU",
      substitution: `(${input.inputTextTokens} + ${estimatedImageTokens.toFixed(2)} + ${outputRatio} x ${input.outputTokens}) x 4 x (${input.rpm} / 60) / ${charsPerGsu} = ${requiredPtus.toFixed(4)}`,
    });
  } else {
    steps.push({
      output: "Required PTU Num",
      result: requiredPtus,
      unit: "raw PTUs",
      formula: "Required PTUs = user supplied capacity estimate",
      substitution: `Required PTUs = ${requiredPtus.toFixed(4)}`,
      note:
        "Microsoft publishes input TPM per PTU for this model but not the output-token weighting needed for an automatic mixed-workload estimate.",
    });
  }

  const utilization = (requiredPtus / deployedPtus) * 100;
  const totalTpm =
    (input.inputTextTokens + inputImageTokens + input.outputTokens) * input.rpm;
  const perMinutePtuCost = ptuCost / MINUTES_PER_MONTH;

  steps.push(
    {
      output: "Deployable PTUs",
      result: deployedPtus,
      unit: "PTUs",
      formula:
        "max(minimum PTUs, ceil(required PTUs / scale increment) x scale increment)",
      substitution: `max(${minimumPtus}, ceil(${requiredPtus.toFixed(4)} / ${scaleIncrement}) x ${scaleIncrement}) = ${deployedPtus}`,
    },
    {
      output: "PTU Utilization",
      result: utilization,
      unit: "%",
      formula: "required PTUs / deployed PTUs x 100",
      substitution: `${requiredPtus.toFixed(4)} / ${deployedPtus} x 100 = ${utilization.toFixed(2)}%`,
    },
    {
      output: "PTU cost",
      result: ptuCost,
      unit: "USD/month",
      formula: "deployed PTUs x PTU unit price x (1 - discount)",
      substitution: `${deployedPtus} x ${pricePerUnit.toFixed(2)} x (1 - ${discount}) = ${ptuCostBeforeDiscount.toFixed(2)} x (1 - ${discount}) = ${ptuCost.toFixed(2)}`,
      note: `${input.commitmentType} commitment; ${deploymentLabel}.`,
    },
    {
      output: "TPM per dollar (in millions)",
      result: tpmPerDollar,
      unit: "million TPM/USD",
      formula:
        "total workload TPM / monthly PTU cost per minute / 1,000,000",
      substitution: `${totalTpm.toFixed(2)} / ${perMinutePtuCost.toFixed(6)} / 1,000,000 = ${tpmPerDollar.toFixed(4)}`,
    },
    {
      output: "PTU Cost Saving (%)",
      result: costSavingPercentage,
      unit: "%",
      formula: "(PayGO cost - PTU cost) / PayGO cost x 100",
      substitution:
        paygo.totalCost > 0
          ? `(${paygo.totalCost.toFixed(2)} - ${ptuCost.toFixed(2)}) / ${paygo.totalCost.toFixed(2)} x 100 = ${costSavingPercentage.toFixed(2)}%`
          : "0% because PayGO cost is 0",
    },
  );

  return {
    modelName: model["model name"],
    provider: model.provider,
    deploymentType: deploymentLabel,
    commitmentType: input.commitmentType,
    inputs: {
      inputTextTokens: input.inputTextTokens,
      inputImageTokens,
      outputTokens: input.outputTokens,
      rpm: input.rpm,
      cacheHitRate: input.cacheHitRate,
      minimumPtus,
      scaleIncrement,
      inputPricePer1k: model["input token price per 1k"],
      cachedInputPricePer1k:
        model["input token price per 1k with cache hit"],
      outputPricePer1k: model["output token price per 1k"],
      ptuPricePerUnit: pricePerUnit,
      ptuDiscount: discount,
      ...(model["PTU input token weights"] ? {
        contextMode: input.contextMode ?? "short",
        cacheWriteTokens,
        cacheWritePricePer1k: requirePositive(model["cache write token price per 1k"], "Cache write price"),
        inputWeight: model["PTU input token weights"].uncached,
        cachedInputWeight: model["PTU input token weights"].cached,
        cacheWriteWeight: model["PTU input token weights"].cacheWrite,
        outputWeight: getOutputRatio(model),
      } : {}),
      ...(usesImageTokenSizing(model) ? {
        imageInputPricePer1k: requirePositive(model["image input token price per 1k"], "Image input price"),
        imageInputWeight: getImageInputRatio(model),
        imageOutputWeight: getOutputRatio(model),
      } : {}),
    },
    steps,
  };
}

interface ScenarioCalculation {
  minimumPtus: number;
  scaleIncrement: number;
  deploymentLabel: string;
  pricePerUnit: number;
  discount: number;
  inputImageTokens: number;
  requiredPtus: number;
  ptuMetrics?: PtuMetrics;
  paygo: CostBreakdown;
  ptuPricing: {
    deployedPtus: number;
    costBeforeDiscount: number;
    discountedCost: number;
  };
  ptuUtilization: number;
  tpmPerDollar: number;
  costSavingPercentage: number;
}

function calculateScenarioValues(input: ScenarioInput): ScenarioCalculation {
  requireNonNegative(input.inputTextTokens, "Input tokens");
  requireNonNegative(input.outputTokens, "Output tokens");
  requireNonNegative(input.rpm, "RPM");
  if (input.cacheHitRate < 0 || input.cacheHitRate > 100) {
    throw new Error("Cache hit rate must be between 0 and 100.");
  }
  input.images.forEach((image, index) => {
    requirePositive(image.width, `Image ${index + 1} width`);
    requirePositive(image.height, `Image ${index + 1} height`);
  });
  const model = getScenarioModel(input);
  if ((input.cacheWriteTokens ?? 0) !== 0 && !model["PTU input token weights"]) {
    throw new Error("This model has no cache-write PTU sizing configuration.");
  }

  const { minimumPtus, scaleIncrement, deploymentLabel } =
    getDeploymentCapacity(input);
  const { pricePerUnit, discount } = getCommitmentPricing(input);
  const inputImageTokens = calculateImageInputTokens(input);
  let requiredPtus: number;
  let ptuMetrics: PtuMetrics | undefined;

  if (usesAutomaticProvisionedSizing(input.model)) {
    const provisioned = calculateProvisionedPtuNum(
      input.inputTextTokens,
      inputImageTokens,
      input.outputTokens,
      input.rpm,
      minimumPtus,
      scaleIncrement,
      requirePositive(model["input TPM per PTU"], "Input TPM per PTU"),
      getOutputRatio(model),
      input.cacheHitRate,
      {
        inputWeights: model["PTU input token weights"],
        cacheWriteTokens: input.cacheWriteTokens,
        imageInputRatio: getImageInputRatio(model),
      },
    );
    requiredPtus = provisioned.requiredPtus;
    ptuMetrics = provisioned.metrics;
  } else if (input.model.provider === "Google") {
    requiredPtus = calculateGooglePtuNum(
      input.inputTextTokens,
      input.images.length,
      input.outputTokens,
      input.rpm,
      requirePositive(
        input.model["output token multiple ratio"],
        "Output token ratio",
      ),
      requirePositive(input.model["chars per GSU"], "Characters per GSU"),
      requirePositive(
        input.model["chars per image(<=128k input tokens)"],
        "Characters per image",
      ),
      requirePositive(
        input.model["chars per image(>128k input tokens)"],
        "Characters per image",
      ),
    );
  } else {
    requiredPtus =
      input.manualRequiredPtus === undefined
        ? minimumPtus
        : input.manualRequiredPtus;
    requireNonNegative(requiredPtus, "Required PTUs");
  }

  const paygo = calculatePaygoCost(
    input.inputTextTokens,
    input.outputTokens,
    input.rpm,
    model,
    input.cacheHitRate,
    inputImageTokens,
    input.images.length,
    input.cacheWriteTokens,
  );
  const ptuPricing = calculatePtuCost(
    requiredPtus,
    minimumPtus,
    scaleIncrement,
    pricePerUnit,
    discount,
  );
  const ptuUtilization =
    requiredPtus / ptuPricing.deployedPtus * 100;
  const tpmPerDollar = calculateTpmPerDollar(
    input.inputTextTokens,
    inputImageTokens,
    input.outputTokens,
    input.rpm,
    ptuPricing.discountedCost,
  );
  const costSavingPercentage =
    paygo.totalCost === 0
      ? 0
      : ((paygo.totalCost - ptuPricing.discountedCost) / paygo.totalCost) * 100;

  return {
    minimumPtus,
    scaleIncrement,
    deploymentLabel,
    pricePerUnit,
    discount,
    inputImageTokens,
    requiredPtus,
    ptuMetrics,
    paygo,
    ptuPricing,
    ptuUtilization,
    tpmPerDollar,
    costSavingPercentage,
  };
}

export function calculateScenario(input: ScenarioInput): ComparisonResult {
  const {
    minimumPtus,
    scaleIncrement,
    deploymentLabel,
    pricePerUnit,
    discount,
    inputImageTokens,
    requiredPtus,
    ptuMetrics,
    paygo,
    ptuPricing,
    ptuUtilization,
    tpmPerDollar,
    costSavingPercentage,
  } = calculateScenarioValues(input);
  const explanation = buildExplanation({
    input,
    inputImageTokens,
    requiredPtus,
    deployedPtus: ptuPricing.deployedPtus,
    minimumPtus,
    scaleIncrement,
    deploymentLabel,
    pricePerUnit,
    discount,
    ptuMetrics,
    paygo,
    ptuCostBeforeDiscount: ptuPricing.costBeforeDiscount,
    ptuCost: ptuPricing.discountedCost,
    tpmPerDollar,
    costSavingPercentage,
  });

  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    createdAt: new Date().toISOString(),
    modelName: input.model["model name"],
    provider: input.model.provider,
    inputTextTokens: input.inputTextTokens,
    inputImageTokens,
    cacheHitRate: input.cacheHitRate,
    outputTokens: input.outputTokens,
    rpm: input.rpm,
    commitmentType: input.commitmentType,
    deploymentType: deploymentLabel,
    requiredPtus,
    deployedPtus: ptuPricing.deployedPtus,
    ptuUtilization,
    paygoCost: paygo.totalCost,
    ptuCost: ptuPricing.discountedCost,
    tpmPerDollar,
    costSavingPercentage,
    paygoBreakdown: paygo,
    ptuCostBeforeDiscount: ptuPricing.costBeforeDiscount,
    ptuDiscount: discount,
    normalizedTpm: ptuMetrics?.normalizedTpm,
    ...(input.model["PTU input token weights"] ? {
      contextMode: input.contextMode ?? "short",
      cacheWriteTokens: input.cacheWriteTokens ?? 0,
    } : {}),
    explanation,
  };
}

function getOptimizationDeployments(input: ScenarioInput): DeploymentType[] {
  if (input.model.provider !== "Azure OpenAI") {
    return ["Global / Data Zone"];
  }

  const hasRegionalConfiguration =
    (input.model["regional PTU minimum deployment unit"] ?? 0) > 0 &&
    (input.model["regional PTU scale increment"] ?? 0) > 0;

  return hasRegionalConfiguration
    ? ["Global / Data Zone", "Regional"]
    : ["Global / Data Zone"];
}

function calculateCurvePoint(
  input: ScenarioInput,
  rpm: number,
): CostCurvePoint {
  const result = calculateScenarioValues({ ...input, rpm });
  return {
    rpm,
    paygoCost: result.paygo.totalCost,
    ptuCost: result.ptuPricing.discountedCost,
    requiredPtus: result.requiredPtus,
    deployedPtus: result.ptuPricing.deployedPtus,
  };
}

function findBreakEvenRpm(input: ScenarioInput): number | undefined {
  const oneRpmPoint = calculateCurvePoint(input, 1);
  if (oneRpmPoint.paygoCost <= 0) {
    return undefined;
  }

  const isAutomaticallySized =
    usesAutomaticProvisionedSizing(input.model) ||
    input.model.provider === "Google";
  if (!isAutomaticallySized || oneRpmPoint.requiredPtus <= 0) {
    return calculateCurvePoint(input, 0).ptuCost / oneRpmPoint.paygoCost;
  }

  const { minimumPtus, scaleIncrement } = getDeploymentCapacity(input);
  const { pricePerUnit, discount } = getCommitmentPricing(input);
  const unitCost = pricePerUnit * (1 - discount);
  const requiredPtusPerRpm = oneRpmPoint.requiredPtus;
  let lowerRequiredPtus = 0;
  let upperRequiredPtus = Math.max(
    scaleIncrement,
    Math.floor(minimumPtus / scaleIncrement) * scaleIncrement,
  );
  let deployedPtus = roundUpPtus(
    Number.EPSILON,
    minimumPtus,
    scaleIncrement,
  );

  for (let tier = 0; tier < 2; tier += 1) {
    const lowerRpm = lowerRequiredPtus / requiredPtusPerRpm;
    const upperRpm = upperRequiredPtus / requiredPtusPerRpm;
    const candidateRpm =
      (deployedPtus * unitCost) / oneRpmPoint.paygoCost;

    if (candidateRpm > lowerRpm && candidateRpm <= upperRpm) {
      return candidateRpm;
    }
    if (candidateRpm <= lowerRpm) {
      return lowerRpm;
    }
    if (requiredPtusPerRpm * unitCost >= oneRpmPoint.paygoCost) {
      return undefined;
    }

    lowerRequiredPtus = upperRequiredPtus;
    upperRequiredPtus += scaleIncrement;
    deployedPtus = upperRequiredPtus;
  }

  return undefined;
}

function getCapacityTransitionRpms(
  input: ScenarioInput,
  maxRpm: number,
): number[] {
  const isAutomaticallySized =
    usesAutomaticProvisionedSizing(input.model) ||
    input.model.provider === "Google";
  if (!isAutomaticallySized) {
    return [];
  }

  const oneRpmPoint = calculateCurvePoint(input, 1);
  if (oneRpmPoint.requiredPtus <= 0) {
    return [];
  }

  const { minimumPtus, scaleIncrement } = getDeploymentCapacity(input);
  const firstBoundary = Math.max(
    scaleIncrement,
    Math.floor(minimumPtus / scaleIncrement) * scaleIncrement,
  );
  const requiredAtMaximum = oneRpmPoint.requiredPtus * maxRpm;
  if (requiredAtMaximum < firstBoundary) {
    return [];
  }

  const transitionCount =
    Math.floor((requiredAtMaximum - firstBoundary) / scaleIncrement) + 1;
  const maximumTransitions = 120;
  const transitionIndexes =
    transitionCount <= maximumTransitions
      ? Array.from({ length: transitionCount }, (_, index) => index)
      : Array.from(
          { length: maximumTransitions },
          (_, index) =>
            Math.round(
              (index * (transitionCount - 1)) / (maximumTransitions - 1),
            ),
        );
  const epsilon = Math.max(maxRpm * 1e-9, Number.EPSILON);

  return Array.from(new Set(transitionIndexes)).flatMap((index) => {
    const capacity = firstBoundary + index * scaleIncrement;
    const transitionRpm = capacity / oneRpmPoint.requiredPtus;
    return [
      transitionRpm,
      Math.min(maxRpm, transitionRpm + epsilon),
    ];
  });
}

export function calculateCostOptimization(
  input: ScenarioInput,
): CostOptimization {
  const deployments = getOptimizationDeployments(input);
  const commitments = ["Monthly", "Yearly"] as const;
  const configurations = deployments.flatMap((deploymentType) =>
    commitments.map((commitmentType) => ({
      deploymentType,
      commitmentType,
      input: {
        ...input,
        deploymentType,
        commitmentType,
      },
    })),
  );

  const paygoAtOneRpm = calculateCurvePoint(configurations[0].input, 1).paygoCost;
  const lowestMinimumPtuCost = Math.min(
    ...configurations.map(({ input: configurationInput }) =>
      calculateScenarioValues({ ...configurationInput, rpm: 0 }).ptuPricing
        .discountedCost,
    ),
  );
  const estimatedBreakEven =
    paygoAtOneRpm > 0 ? lowestMinimumPtuCost / paygoAtOneRpm : 0;
  const maxRpm = Math.max(
    100,
    Math.ceil(input.rpm * 2),
    Math.ceil(estimatedBreakEven * 1.5),
  );
  const sampledRpms = Array.from(
    { length: 41 },
    (_, index) => (maxRpm * index) / 40,
  );
  const configuredBreakEvens = configurations.map((configuration) => ({
    ...configuration,
    breakEvenRpm: findBreakEvenRpm(configuration.input),
  }));
  const transitionRpms = configuredBreakEvens.flatMap((configuration) =>
    getCapacityTransitionRpms(configuration.input, maxRpm),
  );
  const rpms = Array.from(
    new Set([
      ...sampledRpms,
      ...transitionRpms,
      input.rpm,
      ...configuredBreakEvens.flatMap(({ breakEvenRpm }) =>
        breakEvenRpm === undefined || breakEvenRpm > maxRpm
          ? []
          : [breakEvenRpm],
      ),
    ]),
  ).sort((left, right) => left - right);

  const curves: PtuConfigurationCurve[] = configuredBreakEvens.map(
    ({
      deploymentType,
      commitmentType,
      input: configurationInput,
      breakEvenRpm,
    }) => {
      const points = rpms.map((rpm) =>
        calculateCurvePoint(configurationInput, rpm),
      );
      const currentPoint = calculateCurvePoint(configurationInput, input.rpm);
      const savings = currentPoint.paygoCost - currentPoint.ptuCost;

      return {
        id: `${deploymentType}-${commitmentType}`,
        commitmentType,
        deploymentType:
          input.model.provider === "Azure OpenAI"
            ? deploymentType
            : "Configured default",
        points,
        current: {
          ...currentPoint,
          savings,
          savingsPercentage:
            currentPoint.paygoCost === 0
              ? 0
              : (savings / currentPoint.paygoCost) * 100,
        },
        breakEvenRpm,
      };
    },
  );
  const bestConfiguration = curves.reduce((best, candidate) =>
    candidate.current.ptuCost < best.current.ptuCost ? candidate : best,
  );

  return {
    maxRpm,
    configurations: curves,
    bestConfiguration,
  };
}
