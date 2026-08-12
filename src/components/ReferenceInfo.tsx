import { getUiText } from "../i18n";
import type { Language } from "../i18n";

interface ReferenceInfoProps {
  language: Language;
}

export function ReferenceInfo({ language }: ReferenceInfoProps) {
  const text = getUiText(language).reference;

  return (
    <section className="content-card reference-card">
      <div className="section-heading">
        <h2>{text.title}</h2>
        <p>{text.description}</p>
      </div>

      <div className="formula-grid">
        <article>
          <span>01</span>
          <h3>{text.utilization}</h3>
          <code>{text.utilizationFormula}</code>
        </article>
        <article>
          <span>02</span>
          <h3>{text.paygoCost}</h3>
          <code>{text.paygoFormula}</code>
        </article>
        <article>
          <span>03</span>
          <h3>{text.automaticEstimate}</h3>
          <code>{text.automaticFormula}</code>
        </article>
        <article>
          <span>04</span>
          <h3>{text.efficiency}</h3>
          <code>{text.efficiencyFormula}</code>
        </article>
      </div>
    </section>
  );
}
