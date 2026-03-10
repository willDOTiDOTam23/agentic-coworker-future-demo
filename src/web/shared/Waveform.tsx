interface WaveformProps {
  customerValues: number[];
  guideValues: number[];
}

const MIN_BAR_HEIGHT = 10;
const MAX_BAR_HEIGHT = 76;

export function Waveform({ customerValues, guideValues }: WaveformProps) {
  const length = Math.max(customerValues.length, guideValues.length, 24);

  return (
    <div className="waveform-panel">
      <span className="waveform-band-label waveform-band-label-customer">You</span>
      <span className="waveform-band-label waveform-band-label-guide">Guide</span>
      <div className="waveform-bars" aria-hidden="true">
        {Array.from({ length }, (_, index) => {
          const customerValue = customerValues[index] ?? 0.12;
          const guideValue = guideValues[index] ?? 0.12;
          return (
            <span key={index} className="waveform-column">
              <span
                className="waveform-bar waveform-bar-customer"
                style={{ height: `${Math.max(MIN_BAR_HEIGHT, customerValue * MAX_BAR_HEIGHT)}px` }}
              />
              <span
                className="waveform-bar waveform-bar-guide"
                style={{ height: `${Math.max(MIN_BAR_HEIGHT, guideValue * MAX_BAR_HEIGHT)}px` }}
              />
            </span>
          );
        })}
      </div>
    </div>
  );
}
