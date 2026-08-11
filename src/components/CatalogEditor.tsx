import { useEffect, useState } from "react";
import {
  bundledCatalog,
  clearStoredCatalog,
  isCatalogDocument,
  persistCatalog,
} from "../data/catalog";
import type { CatalogDocument } from "../types";

interface CatalogEditorProps {
  catalog: CatalogDocument;
  onCatalogChange: (catalog: CatalogDocument) => void;
}

export function CatalogEditor({
  catalog,
  onCatalogChange,
}: CatalogEditorProps) {
  const [jsonValue, setJsonValue] = useState(() =>
    JSON.stringify(catalog, null, 2),
  );
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    setJsonValue(JSON.stringify(catalog, null, 2));
  }, [catalog]);

  const applyCatalog = () => {
    try {
      const parsedValue: unknown = JSON.parse(jsonValue);
      if (!isCatalogDocument(parsedValue)) {
        throw new Error(
          "The catalog must contain metadata and at least one model with all required pricing fields.",
        );
      }
      persistCatalog(parsedValue);
      onCatalogChange(parsedValue);
      setIsError(false);
      setMessage("Catalog saved in this browser.");
    } catch (error) {
      setIsError(true);
      setMessage(error instanceof Error ? error.message : "Invalid catalog JSON.");
    }
  };

  const resetCatalog = () => {
    clearStoredCatalog();
    onCatalogChange(bundledCatalog);
    setIsError(false);
    setMessage("Bundled catalog restored.");
  };

  return (
    <details className="content-card catalog-card">
      <summary>
        <span>
          <strong>Model catalog</strong>
          <small>
            {catalog.models.length} models &middot; verified{" "}
            {catalog.metadata["verified date"]}
          </small>
        </span>
        <span className="summary-chevron" aria-hidden="true">
          +
        </span>
      </summary>
      <div className="catalog-content">
        <p>{catalog.metadata["pricing scope"]}</p>
        <textarea
          aria-label="Model catalog JSON"
          value={jsonValue}
          onChange={(event) => setJsonValue(event.target.value)}
          spellCheck={false}
        />
        {message ? (
          <p className={isError ? "form-error" : "form-success"}>{message}</p>
        ) : null}
        <div className="button-row">
          <button
            className="button button-primary"
            type="button"
            onClick={applyCatalog}
          >
            Save catalog
          </button>
          <button
            className="button button-secondary"
            type="button"
            onClick={resetCatalog}
          >
            Restore bundled catalog
          </button>
        </div>
      </div>
    </details>
  );
}
