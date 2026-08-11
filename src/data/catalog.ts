import modelConfigDocument from "../../model_config.json";
import type { CatalogDocument, ModelConfig } from "../types";

export const CATALOG_STORAGE_KEY = "ptu-cost-planner-catalog-v2";

export const bundledCatalog: CatalogDocument = modelConfigDocument;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isModelConfig(value: unknown): value is ModelConfig {
  if (!isRecord(value)) {
    return false;
  }

  const requiredStrings = ["model name", "provider"];
  const requiredNumbers = [
    "input token price per 1k",
    "input token price per 1k with cache hit",
    "output token price per 1k",
    "PTU minumum deployment unit",
    "PTU scale increment",
    "PTU price of monthly commitment",
    "PTU price of yearly commitment",
    "PTU monthly discount",
    "PTU yearly discount",
  ];

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
