import { getEntreesParFacture } from "../db/database";
import { generatePdf, downloadPdf } from "../utils/generatePdf";
import "./ClientFacturesPanel.css";

function formatDate(isoStr) {
  if (!isoStr) return "—";
  const [y, m, d] = isoStr.slice(0, 10).split("-");
  return `${parseInt(d)}-${parseInt(m)}-${y}`;
}

export default function ClientFacturesPanel({ client, factures }) {
  async function handleDownloadPdf(facture) {
    try {
      const entries = await getEntreesParFacture(facture.id);
      const { pdfBytes } = await generatePdf(facture, client, entries);
      downloadPdf(pdfBytes, `${facture.numero}.pdf`);
    } catch (err) {
      console.error(err);
      alert("Impossible de générer le PDF. Veuillez réessayer.");
    }
  }

  return (
    <aside className="client-factures-panel">
      <div className="client-factures-panel__header">
        <h2 className="client-factures-panel__title">Factures</h2>
      </div>
      <div className="client-factures-panel__body">
        {factures.length === 0 ? (
          <p className="client-factures-panel__empty">Aucune facture pour ce client.</p>
        ) : (
          <ul className="client-factures-panel__list">
            {factures.map((f) => (
              <li key={f.id} className="client-factures-panel__item">
                <div className="client-factures-panel__item-main">
                  <span className="client-factures-panel__numero">{f.numero}</span>
                  <span className="client-factures-panel__date">{formatDate(f.date_emission)}</span>
                </div>
                <div className="client-factures-panel__item-sub">
                  <span className="client-factures-panel__montant">{(f.montant_total ?? 0).toFixed(2)} $</span>
                  <span className={`client-factures-panel__badge client-factures-panel__badge--${f.statut}`}>
                    {f.statut === "payee" ? "Payée" : "Impayée"}
                  </span>
                  <button
                    className="client-factures-panel__btn-pdf"
                    onClick={() => handleDownloadPdf(f)}
                    title="Télécharger le PDF"
                  >
                    📄
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
