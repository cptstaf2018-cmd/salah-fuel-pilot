type KpiProps = {
  label: string;
  value: string;
  unit?: string;
  note?: string;
  /** The single headline reading, given twice the width in the band. */
  hero?: boolean;
};

export function Kpi({ label, value, unit, note, hero = false }: KpiProps) {
  return (
    <article className={hero ? "kpi kpi-hero" : "kpi"}>
      <p className="kpi-label">{label}</p>
      <p className="kpi-value">
        {value}
        {unit && <span className="kpi-unit">{unit}</span>}
      </p>
      {note && <p className="kpi-note">{note}</p>}
    </article>
  );
}
