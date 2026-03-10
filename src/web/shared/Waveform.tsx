interface WaveformProps {
  label: string;
  values: number[];
}

export function Waveform({ label, values }: WaveformProps) {
  return (
    <div className="waveform-panel">
      <div className="waveform-header">
        <span>{label}</span>
      </div>
      <div className="waveform-bars" aria-hidden="true">
        {values.map((value, index) => (
          <span
            key={`${label}-${index}`}
            className="waveform-bar"
            style={{ height: `${Math.max(16, value * 100)}%` }}
          />
        ))}
      </div>
    </div>
  );
}

