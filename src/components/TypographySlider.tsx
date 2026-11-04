interface TypographySliderProps {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  onChange: (value: number) => void;
}

export default function TypographySlider({
  id,
  label,
  value,
  min,
  max,
  step,
  display,
  onChange,
}: TypographySliderProps) {
  return (
    <div className="field slider-field">
      <div className="slider-field__header">
        <label htmlFor={id}>{label}</label>
        <span className="slider-field__value">{display}</span>
      </div>
      <input
        id={id}
        type="range"
        className="typography-slider"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}
