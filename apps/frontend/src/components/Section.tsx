export function Section({ label, value }: { label: string; value: unknown }): React.ReactElement {
  const rendered = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  return (
    <div className="tool-card__section">
      <div className="tool-card__label">{label}</div>
      <pre className="tool-card__value">{rendered}</pre>
    </div>
  );
}
