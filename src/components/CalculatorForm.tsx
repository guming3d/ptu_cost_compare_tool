import { useState } from "react";
import type {
  CommitmentType,
  ContextMode,
  DeploymentType,
  ModelConfig,
  WorkloadImage,
} from "../types";
import { getLocale, getUiText, localizeDeployment, localizeExplanationText } from "../i18n";
import type { Language } from "../i18n";
import { getAvailableDeployments, supportsAzureImageInput, usesImageTokenSizing } from "../lib/calculations";
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
  contextMode: ContextMode;
  onContextModeChange: (value: ContextMode) => void;
  cacheWriteTokens: number;
  onCacheWriteTokensChange: (value: number) => void;
  cacheWriteOverride: boolean;
  onUseAutomaticCacheWriteTokens: () => void;
  imageInputTokens: number;
  onImageInputTokensChange: (value: number) => void;
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
  ptuOverride: boolean;
  onPtuOverrideChange: (value: boolean) => void;
  preview: {
    requiredPtus: number;
    deployedPtus: number;
    normalizedTpm?: number;
  } | null;
  error: string | null;
  onAdd: () => void;
  onClear: () => void;
  hasResults: boolean;
  mode?: "estimation" | "comparison";
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
  contextMode,
  onContextModeChange,
  cacheWriteTokens,
  onCacheWriteTokensChange,
  cacheWriteOverride,
  onUseAutomaticCacheWriteTokens,
  imageInputTokens,
  onImageInputTokensChange,
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
  ptuOverride,
  onPtuOverrideChange,
  preview,
  error,
  onAdd,
  onClear,
  hasResults,
  mode = "comparison",
  language,
}: CalculatorFormProps) {
  const text = getUiText(language).calculator;
  const guideText = getUiText(language).guide;
  const [guideOpen, setGuideOpen] = useState(() => {
    try {
      return typeof window === "undefined" || window.localStorage.getItem("ptu-guide-dismissed") !== "true";
    } catch {
      return true;
    }
  });
  const [guideStep, setGuideStep] = useState(0);
  const guideTargets = ["model-select", "input-tokens", "requests-per-minute", "target-ptu-result"];
  const guideSteps = [
    { title: guideText.modelTitle, description: guideText.modelDescription },
    { title: guideText.tokensTitle, description: guideText.tokensDescription },
    { title: guideText.trafficTitle, description: guideText.trafficDescription },
    { title: guideText.resultTitle, description: guideText.resultDescription },
  ];
  const toggleGuide = (open: boolean) => {
    setGuideOpen(open);
    if (open) setGuideStep(0);
    try {
      if (open) window.localStorage.removeItem("ptu-guide-dismissed");
      else window.localStorage.setItem("ptu-guide-dismissed", "true");
    } catch {
      // The guide still works when browser storage is unavailable.
    }
  };
  const locale = getLocale(language);
  const deployments = getAvailableDeployments(selectedModel);
  const capacity = selectedModel["PTU deployments"]?.[deploymentType]?.inputTpmPerPtu ?? selectedModel["input TPM per PTU"];
  const isManual = selectedModel["PTU sizing mode"] === "manual";
  const canOverridePtus =
    !isManual &&
    selectedModel.provider.startsWith("Fireworks") &&
    selectedModel["PTU sizing mode"] === "automatic";
  const showManualPtus = isManual || (canOverridePtus && ptuOverride);
  const isImageModel = usesImageTokenSizing(selectedModel);
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
        {mode === "estimation" && !guideOpen ? (
          <button className="guide-reopen" type="button" onClick={() => toggleGuide(true)}>
            {guideText.reopen}
          </button>
        ) : null}
      </div>

      {mode === "estimation" && guideOpen ? (
        <div className="usage-guide" aria-label={guideText.title}>
          <div className="usage-guide-heading">
            <strong>{guideText.title}</strong>
            <button type="button" onClick={() => toggleGuide(false)}>{guideText.dismiss}</button>
          </div>
          <p className="usage-guide-progress">
            {guideText.step} {guideStep + 1} {guideText.of} {guideSteps.length}
          </p>
          <div aria-live="polite">
            <h3>{guideSteps[guideStep].title}</h3>
            <p>{guideSteps[guideStep].description}</p>
          </div>
          <div className="usage-guide-actions">
            <button
              className="button button-secondary button-small"
              type="button"
              onClick={() => document.getElementById(guideTargets[guideStep])?.focus()}
            >
              {guideText.goToStep}
            </button>
            {guideStep > 0 ? (
              <button type="button" onClick={() => setGuideStep(guideStep - 1)}>{guideText.back}</button>
            ) : null}
            <button type="button" onClick={() =>
              guideStep === guideSteps.length - 1
                ? toggleGuide(false)
                : setGuideStep(guideStep + 1)
            }>
              {guideStep === guideSteps.length - 1 ? guideText.finish : guideText.next}
            </button>
          </div>
        </div>
      ) : null}

      <label className="field">
        <span className="field-label">{text.model}</span>
        <select
          id="model-select"
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
        {selectedModel["PayGO status"] === "retired" ? (
          <span className="field-hint">{text.paygoRetired} {selectedModel["PayGO retirement date"]}</span>
        ) : selectedModel["PayGO status"] === "unverified" ? (
          <span className="field-hint">{text.paygoUnavailable}</span>
        ) : null}
        {isImageModel ? (
          <span className="field-hint">
            {text.imagePaygoScopeHint}{" "}
            {selectedModel["PayGO pricing scope"] ?? text.unverifiedPaygoScope}
          </span>
        ) : null}
        {selectedModel["PTU maximum prompt tokens"] ? (
          <span className="field-hint">{text.promptLimit} {selectedModel["PTU maximum prompt tokens"].toLocaleString(locale)}</span>
        ) : null}
      </label>

      <div className="field-grid">
        <NumberField
          id="input-tokens"
          label={isImageModel ? text.textInputTokens : text.inputTokens}
          value={inputTextTokens}
          onChange={onInputTextTokensChange}
        />
        <NumberField
          label={isImageModel ? text.imageOutputTokens : text.outputTokens}
          value={outputTokens}
          onChange={onOutputTokensChange}
        />
      </div>

      {selectedModel["long context"] ? (
        <label className="field">
          <span className="field-label">{text.contextMode}</span>
          <select
            value={contextMode}
            onChange={(event) =>
              onContextModeChange(event.target.value === "long" ? "long" : "short")
            }
          >
            <option value="short">{text.shortContext}</option>
            <option value="long">{text.longContext}</option>
          </select>
          <span className="field-hint">
            {text.normalizedContextHint}
          </span>
        </label>
      ) : null}

      {selectedModel["PTU input token weights"] ? (
        <>
          <NumberField
            label={text.cacheWriteTokens}
            value={cacheWriteTokens}
            onChange={onCacheWriteTokensChange}
            step={0.01}
            hint={text.cacheWriteHint}
          />
          {cacheWriteOverride ? (
            <button
              className="button button-secondary button-small"
              type="button"
              onClick={onUseAutomaticCacheWriteTokens}
            >
              {text.useAutomaticCacheWrites}
            </button>
          ) : null}
        </>
      ) : null}

      <NumberField
        id="requests-per-minute"
        label={text.rpm}
        value={rpm}
        onChange={onRpmChange}
        hint={text.rpmHint}
      />

      {isImageModel ? (
        <span className="field-hint">{text.imageCacheHint}</span>
      ) : (
        <label className="field">
          <span className="field-label">
            {text.cacheHitRate} <strong>{cacheHitRate}%</strong>
          </span>
          <input
            className="range-input"
            type="range"
            min="0"
            max="100"
            step="1"
            value={cacheHitRate}
            onChange={(event) => onCacheHitRateChange(Number(event.target.value))}
          />
          <span className="range-scale">
            <span>0%</span>
            <span>100%</span>
          </span>
        </label>
      )}

      {deployments.length > 1 || deployments[0] !== "Global" ? (
        <label className="field">
          <span className="field-label">{text.provisionedDeployment}</span>
          <select
            value={deploymentType}
            onChange={(event) => {
              if (isManual) {
                onManualRequiredPtusChange(0);
              }
              onDeploymentTypeChange(event.target.value as DeploymentType);
            }}
          >
            {deployments.map((deployment) => (
              <option key={deployment} value={deployment}>{localizeDeployment(deployment, language)}</option>
            ))}
          </select>
        </label>
      ) : null}

      {selectedModel["global provisioned only"] ? (
        <span className="field-hint">{text.globalProvisionedOnly}</span>
      ) : null}

      {canOverridePtus ? (
        <label className="checkbox-field">
          <input
            type="checkbox"
            checked={ptuOverride}
            onChange={(event) => onPtuOverrideChange(event.target.checked)}
          />
          <span className="field-label">{text.overridePtus}</span>
        </label>
      ) : null}

      {canOverridePtus && !ptuOverride ? (
        <span className="field-hint">
          {text.automaticFireworksHint}{" "}
          {selectedModel["output token multiple ratio"]?.toLocaleString(locale)}
        </span>
      ) : null}

      {showManualPtus ? (
        <NumberField
          label={text.requiredPtus}
          value={manualRequiredPtus}
          onChange={onManualRequiredPtusChange}
          min={1}
          step={1}
          hint={`${text.publishedCapacity}: ${
            capacity?.toLocaleString(locale) ?? "N/A"
          } ${text.benchmarkHint}${isManual ? ` ${text.manualDeploymentHint}` : ""}`}
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

      <span className="field-hint">{text.ptuPricingAssumption}</span>

      {isImageModel ? (
        <NumberField
          label={text.imageInputTokens}
          value={imageInputTokens}
          onChange={onImageInputTokensChange}
          hint={text.imageTokenHint}
        />
      ) : (
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
      )}

      {mode === "comparison" ? (
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
      ) : null}

      {error ? <p className="form-error">{localizeExplanationText(error, language)}</p> : null}

      {mode === "comparison" ? (
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
      ) : null}
    </aside>
  );
}
