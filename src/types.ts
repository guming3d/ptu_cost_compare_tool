export type CommitmentType = "Monthly" | "Yearly";
export type DeploymentType = "Global / Data Zone" | "Regional";
export type ImageQuality = "low" | "high";

export interface CatalogMetadata {
  "verified date": string;
  currency: string;
  "pricing scope": string;
  "ptu sizing source": string;
  "pricing source": string;
  "ptu reservation source": string;
  notes: string[];
}

export interface ModelConfig {
  "model name": string;
  provider: string;
  "input token price per 1k": number;
  "input token price per 1k with cache hit": number;
  "output token price per 1k": number;
  "PTU minumum deployment unit": number;
  "PTU scale increment": number;
  "PTU price of monthly commitment": number;
  "PTU price of yearly commitment": number;
  "PTU monthly discount": number;
  "PTU yearly discount": number;
  "regional PTU minimum deployment unit"?: number;
  "regional PTU scale increment"?: number;
  "input TPM per PTU"?: number;
  "output token multiple ratio"?: number;
  "PTU sizing mode"?: string;
  "chars per GSU"?: number;
  "price per image(<=128k input tokens)"?: number;
  "price per image(>128k input tokens)"?: number;
  "chars per image(<=128k input tokens)"?: number;
  "chars per image(>128k input tokens)"?: number;
}

export interface CatalogDocument {
  metadata: CatalogMetadata;
  models: ModelConfig[];
}

export interface WorkloadImage {
  id: string;
  width: number;
  height: number;
  quality: ImageQuality;
}

export interface ScenarioInput {
  model: ModelConfig;
  inputTextTokens: number;
  outputTokens: number;
  rpm: number;
  cacheHitRate: number;
  images: WorkloadImage[];
  commitmentType: CommitmentType;
  deploymentType: DeploymentType;
  manualRequiredPtus?: number;
}

export interface PtuMetrics {
  effectiveTextInput: number;
  totalInputTpm: number;
  totalOutputTpm: number;
  normalizedTpm: number;
}

export interface CalculationStep {
  output: string;
  result: number | string;
  unit: string;
  formula: string;
  substitution: string;
  note?: string;
}

export interface CalculationExplanation {
  modelName: string;
  provider: string;
  deploymentType: string;
  commitmentType: CommitmentType;
  inputs: Record<string, number | string>;
  steps: CalculationStep[];
}

export interface CostBreakdown {
  nonCachedInputCost: number;
  cachedInputCost: number;
  inputCost: number;
  outputCost: number;
  totalCost: number;
}

export interface ComparisonResult {
  id: string;
  createdAt: string;
  modelName: string;
  provider: string;
  inputTextTokens: number;
  inputImageTokens: number;
  cacheHitRate: number;
  outputTokens: number;
  rpm: number;
  commitmentType: CommitmentType;
  deploymentType: string;
  requiredPtus: number;
  deployedPtus: number;
  ptuUtilization: number;
  paygoCost: number;
  ptuCost: number;
  tpmPerDollar: number;
  costSavingPercentage: number;
  paygoBreakdown: CostBreakdown;
  ptuCostBeforeDiscount: number;
  ptuDiscount: number;
  normalizedTpm?: number;
  explanation: CalculationExplanation;
}

export interface CostCurvePoint {
  rpm: number;
  paygoCost: number;
  ptuCost: number;
  deployedPtus: number;
}

export interface PtuConfigurationCurve {
  id: string;
  commitmentType: CommitmentType;
  deploymentType: string;
  points: CostCurvePoint[];
  current: CostCurvePoint & {
    savings: number;
    savingsPercentage: number;
  };
  breakEvenRpm?: number;
}

export interface CostOptimization {
  maxRpm: number;
  configurations: PtuConfigurationCurve[];
  bestConfiguration: PtuConfigurationCurve;
}
