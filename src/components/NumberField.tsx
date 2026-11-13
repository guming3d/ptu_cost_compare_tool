interface NumberFieldProps {
  id?: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  hint?: string;
}

export function NumberField({
  id,
  label,
  value,
  onChange,
  min = 0,
  max,
  step = 1,
  hint,
}: NumberFieldProps) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <input
        id={id}
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => {
          const nextValue = Number(event.target.value);
          onChange(Number.isFinite(nextValue) ? nextValue : min);
        }}
      />
      {hint ? <span className="field-hint">{hint}</span> : null}
    </label>
  );
}
