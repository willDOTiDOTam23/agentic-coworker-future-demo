interface WaveformProps {
  customerValues: number[];
  guideValues: number[];
}

const MIN_BAR_HEIGHT = 8;
const MAX_BAR_HEIGHT = 42;

export function Waveform({ customerValues, guideValues }: WaveformProps) {
  const length = Math.max(customerValues.length, guideValues.length, 24);

  return (
    <div className="waveform-panel">
      <div className="waveform-header">
        <span className="waveform-title">Conversation waveform</span>
        <div className="waveform-legend" aria-label="Waveform legend">
          <span className="waveform-legend-item">
            <span className="waveform-swatch waveform-swatch-guide" aria-hidden="true" />
            Guide
          </span>
          <span className="waveform-legend-item">
            <span className="waveform-swatch waveform-swatch-customer" aria-hidden="true" />
            Customer
          </span>
        </div>
      </div>

      <div className="waveform-bars" aria-hidden="true">
        {Array.from({ length }, (_, index) => {
          const guideValue = guideValues[index] ?? 0.12;
          const customerValue = customerValues[index] ?? 0.12;
          return (
            <span key={index} className="waveform-column">
              <span
                className="waveform-bar waveform-bar-guide"
                style={{ height: `${Math.max(MIN_BAR_HEIGHT, guideValue * MAX_BAR_HEIGHT)}px` }}
              />
              <span
                className="waveform-bar waveform-bar-customer"
                style={{ height: `${Math.max(MIN_BAR_HEIGHT, customerValue * MAX_BAR_HEIGHT)}px` }}
              />
            </span>
          );
        })}
      </div>
    </div>
  );
}
