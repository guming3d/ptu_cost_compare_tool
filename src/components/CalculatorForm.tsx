import type {
  CommitmentType,
  DeploymentType,
  ModelConfig,
  WorkloadImage,
} from "../types";
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
}: CalculatorFormProps) {
  const isAzure = selectedModel.provider === "Azure OpenAI";
  const isManual = !isAzure && selectedModel.provider !== "Google";
  const imageMeteringSupported =
    selectedModel.provider === "Google" ||
    selectedModelName.toLowerCase().includes("gpt-4o") ||
    selectedModelName.toLowerCase().includes("gpt-4.1");

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
    <aside className="calculator-card" aria-label="Workload inputs">
      <div className="section-heading">
        <h2>Model and traffic</h2>
      </div>

      <label className="field">
        <span className="field-label">Model</span>
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
          label="Input tokens / request"
          value={inputTextTokens}
          onChange={onInputTextTokensChange}
        />
        <NumberField
          label="Output tokens / request"
          value={outputTokens}
          onChange={onOutputTokensChange}
        />
      </div>

      <NumberField
        label="Requests per minute"
        value={rpm}
        onChange={onRpmChange}
      />

      <label className="field">
        <span className="field-label">
          Cache hit rate <strong>{cacheHitRate}%</strong>
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
          <span className="field-label">Provisioned deployment</span>
          <select
            value={deploymentType}
            onChange={(event) =>
              onDeploymentTypeChange(event.target.value as DeploymentType)
            }
          >
            <option value="Global / Data Zone">Global / Data Zone</option>
            <option value="Regional">Regional</option>
          </select>
        </label>
      ) : null}

      {isManual ? (
        <NumberField
          label="Required PTUs"
          value={manualRequiredPtus}
          onChange={onManualRequiredPtusChange}
          min={1}
          step={1}
          hint={`Published capacity: ${selectedModel["input TPM per PTU"]?.toLocaleString("en-US") ?? "N/A"} input TPM/PTU. Enter a benchmarked capacity estimate.`}
        />
      ) : null}

      <label className="field">
        <span className="field-label">Commitment</span>
        <select
          value={commitmentType}
          onChange={(event) =>
            onCommitmentTypeChange(event.target.value as CommitmentType)
          }
        >
          <option value="Monthly">Monthly</option>
          <option value="Yearly">Yearly</option>
        </select>
      </label>

      <div className="image-section">
        <div className="image-section-header">
          <div>
            <span className="field-label">Image inputs</span>
            <span className="field-hint">
              {imageMeteringSupported
                ? "Optional image workload per request."
                : "This model has no image sizing rule in the catalog."}
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
            Add image
          </button>
        </div>

        {images.map((image, index) => (
          <div className="image-row" key={image.id}>
            <span className="image-index">{index + 1}</span>
            <input
              aria-label={`Image ${index + 1} width`}
              type="number"
              min="1"
              value={image.width}
              onChange={(event) =>
                updateImage(image.id, { width: Number(event.target.value) })
              }
            />
            <span className="dimension-separator">x</span>
            <input
              aria-label={`Image ${index + 1} height`}
              type="number"
              min="1"
              value={image.height}
              onChange={(event) =>
                updateImage(image.id, { height: Number(event.target.value) })
              }
            />
            <select
              aria-label={`Image ${index + 1} quality`}
              value={image.quality}
              onChange={(event) =>
                updateImage(image.id, {
                  quality: event.target.value as WorkloadImage["quality"],
                })
              }
            >
              <option value="low">Low</option>
              <option value="high">High</option>
            </select>
            <button
              className="icon-button"
              type="button"
              aria-label={`Remove image ${index + 1}`}
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
          <span>Required capacity</span>
          <strong>
            {preview ? preview.requiredPtus.toFixed(2) : "--"}{" "}
            <small>PTUs</small>
          </strong>
        </div>
        <div>
          <span>Deployable capacity</span>
          <strong>
            {preview ? preview.deployedPtus.toFixed(0) : "--"}{" "}
            <small>PTUs</small>
          </strong>
        </div>
        {preview?.normalizedTpm !== undefined ? (
          <p>
            {preview.normalizedTpm.toLocaleString("en-US", {
              maximumFractionDigits: 0,
            })}{" "}
            normalized TPM
          </p>
        ) : null}
      </div>

      {error ? <p className="form-error">{error}</p> : null}

      <div className="button-row">
        <button className="button button-primary" type="button" onClick={onAdd}>
          Add comparison
        </button>
        <button
          className="button button-secondary"
          type="button"
          onClick={onClear}
          disabled={!hasResults}
        >
          Clear
        </button>
      </div>
    </aside>
  );
}
