import modelConfigDocument from "../../model_config.json";
import type { CatalogDocument, ModelConfig } from "../types";

export const CATALOG_STORAGE_KEY = "ptu-cost-planner-catalog-v2";

export const bundledCatalog = modelConfigDocument as CatalogDocument;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPositive(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function hasValidTokenPrices(value: Record<string, unknown>): boolean {
  return [
    "input token price per 1k",
    "input token price per 1k with cache hit",
    "output token price per 1k",
  ].every((key) =>
    value[key] === null ||
    (typeof value[key] === "number" && Number.isFinite(value[key]) && value[key] >= 0),
  );
}

function hasValidNormalizedTextConfig(value: Record<string, unknown>): boolean {
  const weights = value["PTU input token weights"];
  return (
    isRecord(weights) &&
    isPositive(weights.uncached) &&
    typeof weights.cached === "number" &&
    Number.isFinite(weights.cached) &&
    weights.cached >= 0 &&
    isPositive(weights.cacheWrite) &&
    isPositive(value["input token price per 1k"]) &&
    isPositive(value["input token price per 1k with cache hit"]) &&
    isPositive(value["cache write token price per 1k"]) &&
    isPositive(value["output token price per 1k"]) &&
    isPositive(value["output token multiple ratio"])
  );
}

function isModelConfig(value: unknown): value is ModelConfig {
  if (!isRecord(value)) {
    return false;
  }

  const requiredStrings = ["model name", "provider"];
  const requiredNumbers = [
    "PTU minumum deployment unit",
    "PTU scale increment",
    "PTU price of monthly commitment",
    "PTU price of yearly commitment",
    "PTU monthly discount",
    "PTU yearly discount",
  ];

  if (!hasValidTokenPrices(value)) {
    return false;
  }
  if ("PTU input token weights" in value && !hasValidNormalizedTextConfig(value)) {
    return false;
  }
  if ("long context" in value) {
    const longContext = value["long context"];
    if (
      !hasValidNormalizedTextConfig(value) ||
      !isRecord(longContext) ||
      !hasValidNormalizedTextConfig(longContext)
    ) {
      return false;
    }
  }
  const imageFields = [
    "image input TPM per PTU",
    "image output-to-input ratio",
    "image input token price per 1k",
  ];
  if (
    imageFields.some((key) => key in value) &&
    (!isPositive(value["input TPM per PTU"]) ||
      !imageFields.every((key) =>
        isPositive(value[key]) ||
        (key === "image input token price per 1k" && value[key] === null),
      ))
  ) {
    return false;
  }
  if (
    "configuration notes" in value &&
    (!Array.isArray(value["configuration notes"]) ||
      !value["configuration notes"].every((note) => typeof note === "string"))
  ) {
    return false;
  }
  if (
    ("PayGO status" in value &&
      (typeof value["PayGO status"] !== "string" ||
        !["available", "retired", "unverified"].includes(value["PayGO status"]))) ||
    ("PTU sizing mode" in value &&
      (typeof value["PTU sizing mode"] !== "string" ||
        !["manual", "automatic"].includes(value["PTU sizing mode"]))) ||
    ("PTU maximum prompt tokens" in value && !isPositive(value["PTU maximum prompt tokens"])) ||
    ["catalog model id", "PayGO pricing scope", "PayGO retirement date"].some((key) =>
      key in value && typeof value[key] !== "string",
    )
  ) {
    return false;
  }
  if ("PTU deployments" in value) {
    const deployments = value["PTU deployments"];
    if (
      !isRecord(deployments) ||
      Object.keys(deployments).length === 0 ||
      !Object.entries(deployments).every(([name, config]) =>
        ["Global / Data Zone", "Regional", "Global", "Data Zone", "Global (standard capacity)"].includes(name) &&
        !(value["global provisioned only"] && name !== "Global") &&
        isRecord(config) &&
        isPositive(config.minimumPtus) &&
        isPositive(config.scaleIncrement) &&
        isPositive(config.inputTpmPerPtu) &&
        (!("paygo" in config) || (isRecord(config.paygo) && hasValidTokenPrices(config.paygo))) &&
        (!("paygoScope" in config) || typeof config.paygoScope === "string"),
      )
    ) {
      return false;
    }
  }
  if (
    "global provisioned only" in value &&
    typeof value["global provisioned only"] !== "boolean"
  ) {
    return false;
  }

  return (
    requiredStrings.every((key) => typeof value[key] === "string") &&
    requiredNumbers.every(
      (key) => typeof value[key] === "number" && Number.isFinite(value[key]),
    )
  );
}

export function isCatalogDocument(value: unknown): value is CatalogDocument {
  if (!isRecord(value) || !isRecord(value.metadata) || !Array.isArray(value.models)) {
    return false;
  }

  return (
    typeof value.metadata["verified date"] === "string" &&
    typeof value.metadata.currency === "string" &&
    typeof value.metadata["pricing scope"] === "string" &&
    Array.isArray(value.metadata.notes) &&
    value.models.length > 0 &&
    value.models.every(isModelConfig)
  );
}

export function readStoredCatalog(): CatalogDocument {
  try {
    const storedValue = window.localStorage.getItem(CATALOG_STORAGE_KEY);
    if (!storedValue) {
      return bundledCatalog;
    }

    const parsedValue: unknown = JSON.parse(storedValue);
    return isCatalogDocument(parsedValue) ? parsedValue : bundledCatalog;
  } catch {
    return bundledCatalog;
  }
}

export function persistCatalog(catalog: CatalogDocument): void {
  window.localStorage.setItem(CATALOG_STORAGE_KEY, JSON.stringify(catalog));
}

export function clearStoredCatalog(): void {
  window.localStorage.removeItem(CATALOG_STORAGE_KEY);
}
