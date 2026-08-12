export function ReferenceInfo() {
  return (
    <section className="content-card reference-card">
      <div className="section-heading">
        <h2>Reference formulas</h2>
        <p>
          The calculator keeps the original monthly cost and throughput rules,
          presented here in a more compact format.
        </p>
      </div>

      <div className="formula-grid">
        <article>
          <span>01</span>
          <h3>PTU utilization</h3>
          <code>required PTUs / rounded deployable PTUs x 100</code>
        </article>
        <article>
          <span>02</span>
          <h3>PayGO monthly cost</h3>
          <code>
            tokens/request x RPM x 60 x 24 x 30.42 / 1,000 x token price
          </code>
        </article>
        <article>
          <span>03</span>
          <h3>Automatic PTU estimate</h3>
          <code>
            (input TPM + output ratio x output TPM) / input TPM per PTU
          </code>
        </article>
        <article>
          <span>04</span>
          <h3>TPM per dollar</h3>
          <code>
            workload TPM / PTU cost per minute / 1,000,000
          </code>
        </article>
      </div>
    </section>
  );
}
