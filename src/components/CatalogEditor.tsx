import { useEffect, useState } from "react";
import {
  bundledCatalog,
  clearStoredCatalog,
  isCatalogDocument,
  persistCatalog,
} from "../data/catalog";
import { getUiText } from "../i18n";
import type { Language } from "../i18n";
import type { CatalogDocument } from "../types";

interface CatalogEditorProps {
  catalog: CatalogDocument;
  onCatalogChange: (catalog: CatalogDocument) => void;
  language: Language;
}

export function CatalogEditor({
  catalog,
  onCatalogChange,
  language,
}: CatalogEditorProps) {
  const text = getUiText(language).catalog;
  const [jsonValue, setJsonValue] = useState(() =>
    JSON.stringify(catalog, null, 2),
  );
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    setJsonValue(JSON.stringify(catalog, null, 2));
  }, [catalog]);

  useEffect(() => {
    setMessage(null);
  }, [language]);

  const applyCatalog = () => {
    try {
      const parsedValue: unknown = JSON.parse(jsonValue);
      if (!isCatalogDocument(parsedValue)) {
        throw new Error(
          text.invalid,
        );
      }
      persistCatalog(parsedValue);
      onCatalogChange(parsedValue);
      setIsError(false);
      setMessage(text.saved);
    } catch (error) {
      setIsError(true);
      setMessage(
        error instanceof SyntaxError
          ? text.invalidJson
          : error instanceof Error
            ? error.message
            : text.invalidJson,
      );
    }
  };

  const resetCatalog = () => {
    clearStoredCatalog();
    onCatalogChange(bundledCatalog);
    setIsError(false);
    setMessage(text.restored);
  };

  return (
    <details className="content-card catalog-card">
      <summary>
        <span>
          <strong>{text.title}</strong>
          <small>
            {catalog.models.length} {text.models} &middot; {text.verified}{" "}
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
          aria-label={text.jsonLabel}
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
            {text.save}
          </button>
          <button
            className="button button-secondary"
            type="button"
            onClick={resetCatalog}
          >
            {text.restore}
          </button>
        </div>
      </div>
    </details>
  );
}
