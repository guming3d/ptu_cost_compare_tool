import type {
  CommitmentType,
  DeploymentType,
  ModelConfig,
  WorkloadImage,
} from "../types";
import { getLocale, getUiText } from "../i18n";
import type { Language } from "../i18n";
import { supportsAzureImageInput } from "../lib/calculations";
import { NumberField } from "./NumberField";

interface CalculatorFormProps {
  models: ModelConfig[];
  selectedModelName: string;
  onModelChange: (modelName: string) => void;
  selectedModel: ModelConfig;
  inputTextTokens: number;
  onInputTextTokensChange: (value: number) => void;
  cacheHitRate: number;
  onCacheHitRateChange: (value: number) => void;
  outputTokens: number;
  onOutputTokensChange: (value: number) => void;
  rpm: number;
  onRpmChange: (value: number) => void;
  images: WorkloadImage[];
  onImagesChange: (images: WorkloadImage[]) => void;
  deploymentType: DeploymentType;
  onDeploymentTypeChange: (value: DeploymentType) => void;
  commitmentType: CommitmentType;
  onCommitmentTypeChange: (value: CommitmentType) => void;
  manualRequiredPtus: number;
  onManualRequiredPtusChange: (value: number) => void;
  preview: {
    requiredPtus: number;
    deployedPtus: number;
    normalizedTpm?: number;
  } | null;
  error: string | null;
  onAdd: () => void;
  onClear: () => void;
  hasResults: boolean;
  language: Language;
}

function createImage(index: number): WorkloadImage {
  return {
    id: `${Date.now()}-${index}`,
    width: 1024,
    height: 768,
    quality: "low",
  };
}

export function CalculatorForm({
  models,
  selectedModelName,
  onModelChange,
  selectedModel,
  inputTextTokens,
  onInputTextTokensChange,
  cacheHitRate,
  onCacheHitRateChange,
  outputTokens,
  onOutputTokensChange,
  rpm,
  onRpmChange,
  images,
  onImagesChange,
  deploymentType,
  onDeploymentTypeChange,
  commitmentType,
  onCommitmentTypeChange,
  manualRequiredPtus,
  onManualRequiredPtusChange,
  preview,
  error,
  onAdd,
  onClear,
  hasResults,
  language,
}: CalculatorFormProps) {
  const text = getUiText(language).calculator;
  const locale = getLocale(language);
  const isAzure = selectedModel.provider === "Azure OpenAI";
  const isManual = selectedModel["PTU sizing mode"] === "manual";
  const imageMeteringSupported =
    selectedModel.provider === "Google" ||
    (selectedModel.provider === "Azure OpenAI" &&
      supportsAzureImageInput(selectedModelName));

  const updateImage = (
    id: string,
    changes: Partial<Omit<WorkloadImage, "id">>,
  ) => {
    onImagesChange(
      images.map((image) =>
        image.id === id ? { ...image, ...changes } : image,
      ),
    );
  };

  return (
    <aside className="calculator-card" aria-label={text.ariaLabel}>
      <div className="section-heading">
        <h2>{text.heading}</h2>
      </div>

      <label className="field">
        <span className="field-label">{text.model}</span>
        <select
          value={selectedModelName}
          onChange={(event) => onModelChange(event.target.value)}
        >
          {models.map((model) => (
            <option key={model["model name"]} value={model["model name"]}>
              {model["model name"]}
            </option>
          ))}
        </select>
        <span className="field-hint">{selectedModel.provider}</span>
      </label>

      <div className="field-grid">
        <NumberField
          label={text.inputTokens}
          value={inputTextTokens}
          onChange={onInputTextTokensChange}
        />
        <NumberField
          label={text.outputTokens}
          value={outputTokens}
          onChange={onOutputTokensChange}
        />
      </div>

      <NumberField
        label={text.rpm}
        value={rpm}
        onChange={onRpmChange}
      />

      <label className="field">
        <span className="field-label">
          {text.cacheHitRate} <strong>{cacheHitRate}%</strong>
        </span>
        <input
          className="range-input"
          type="range"
          min="0"
          max="100"
          step="5"
          value={cacheHitRate}
          onChange={(event) => onCacheHitRateChange(Number(event.target.value))}
        />
        <span className="range-scale">
          <span>0%</span>
          <span>100%</span>
        </span>
      </label>

      {isAzure ? (
        <label className="field">
          <span className="field-label">{text.provisionedDeployment}</span>
          <select
            value={deploymentType}
            onChange={(event) =>
              onDeploymentTypeChange(event.target.value as DeploymentType)
            }
          >
            <option value="Global / Data Zone">{text.globalDataZone}</option>
            <option value="Regional">{text.regional}</option>
          </select>
        </label>
      ) : null}

      {isManual ? (
        <NumberField
          label={text.requiredPtus}
          value={manualRequiredPtus}
          onChange={onManualRequiredPtusChange}
          min={1}
          step={1}
          hint={`${text.publishedCapacity}: ${
            selectedModel["input TPM per PTU"]?.toLocaleString(locale) ?? "N/A"
          } ${text.benchmarkHint}`}
        />
      ) : null}

      <label className="field">
        <span className="field-label">{text.commitment}</span>
        <select
          value={commitmentType}
          onChange={(event) =>
            onCommitmentTypeChange(event.target.value as CommitmentType)
          }
        >
          <option value="Monthly">{text.monthly}</option>
          <option value="Yearly">{text.yearly}</option>
        </select>
      </label>

      <div className="image-section">
        <div className="image-section-header">
          <div>
            <span className="field-label">{text.imageInputs}</span>
            <span className="field-hint">
              {imageMeteringSupported
                ? text.optionalImage
                : text.noImageRule}
            </span>
          </div>
          <button
            className="button button-small button-secondary"
            type="button"
            disabled={!imageMeteringSupported}
            onClick={() =>
              onImagesChange([...images, createImage(images.length)])
            }
          >
            {text.addImage}
          </button>
        </div>

        {images.map((image, index) => (
          <div className="image-row" key={image.id}>
            <span className="image-index">{index + 1}</span>
            <input
              aria-label={`${text.image} ${index + 1} ${text.width}`}
              type="number"
              min="1"
              value={image.width}
              onChange={(event) =>
                updateImage(image.id, { width: Number(event.target.value) })
              }
            />
            <span className="dimension-separator">x</span>
            <input
              aria-label={`${text.image} ${index + 1} ${text.height}`}
              type="number"
              min="1"
              value={image.height}
              onChange={(event) =>
                updateImage(image.id, { height: Number(event.target.value) })
              }
            />
            <select
              aria-label={`${text.image} ${index + 1}`}
              value={image.quality}
              onChange={(event) =>
                updateImage(image.id, {
                  quality: event.target.value as WorkloadImage["quality"],
                })
              }
            >
              <option value="low">{text.low}</option>
              <option value="high">{text.high}</option>
            </select>
            <button
              className="icon-button"
              type="button"
              aria-label={`${text.removeImage} ${index + 1}`}
              onClick={() =>
                onImagesChange(images.filter((item) => item.id !== image.id))
              }
            >
              &times;
            </button>
          </div>
        ))}
      </div>

      <div className="estimate-panel" aria-live="polite">
        <div>
          <span>{text.requiredCapacity}</span>
          <strong>
            {preview ? preview.requiredPtus.toFixed(2) : "--"}{" "}
            <small>PTUs</small>
          </strong>
        </div>
        <div>
          <span>{text.deployableCapacity}</span>
          <strong>
            {preview ? preview.deployedPtus.toFixed(0) : "--"}{" "}
            <small>PTUs</small>
          </strong>
        </div>
        {preview?.normalizedTpm !== undefined ? (
          <p>
            {preview.normalizedTpm.toLocaleString(locale, {
              maximumFractionDigits: 0,
            })}{" "}
            {text.normalizedTpm}
          </p>
        ) : null}
      </div>

      {error ? <p className="form-error">{error}</p> : null}

      <div className="button-row">
        <button className="button button-primary" type="button" onClick={onAdd}>
          {text.addComparison}
        </button>
        <button
          className="button button-secondary"
          type="button"
          onClick={onClear}
          disabled={!hasResults}
        >
          {text.clear}
        </button>
      </div>
    </aside>
  );
}
