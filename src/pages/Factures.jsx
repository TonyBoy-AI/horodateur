import { useState, useEffect } from "react";
import {
  getClients,
  getFactures,
  getEntreesSansFacture,
  createFacture,
  linkEntreesToFacture,
  updateFactureStatut,
  getEntreesParFacture,
} from "../db/database";
import { generatePdf, downloadPdf, groupByWeek } from "../utils/generatePdf";
import "./Factures.css";

function formatDate(isoStr) {
  return isoStr ? isoStr.slice(0, 10) : "—";
}

function formatDuration(minutes) {
  if (!minutes) return "0m";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h${m > 0 ? m : ""}` : `${m}m`;
}

function autoNumero(count) {
  return `F-${new Date().getFullYear()}-${String(count + 1).padStart(3, "0")}`;
}

export default function Factures() {
  const [factures, setFactures] = useState([]);
  const [clients, setClients] = useState([]);
  const [panelOpen, setPanelOpen] = useState(false);

  const [clientId, setClientId] = useState("");
  const [entrees, setEntrees] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [numero, setNumero] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [pdfWarning, setPdfWarning] = useState(null);

  useEffect(() => {
    loadFactures();
    getClients().then(setClients).catch(console.error);
  }, []);

  function loadFactures() {
    getFactures().then(setFactures).catch(console.error);
  }

  useEffect(() => {
    if (!clientId) { setEntrees([]); setSelectedIds(new Set()); return; }
    getEntreesSansFacture(Number(clientId))
      .then((rows) => {
        setEntrees(rows);
        setSelectedIds(new Set(rows.map((e) => e.id)));
      })
      .catch(console.error);
  }, [clientId]);

  function openPanel() {
    setClientId("");
    setEntrees([]);
    setSelectedIds(new Set());
    setNumero(autoNumero(factures.length));
    setPanelOpen(true);
  }

  function toggleEntry(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const selectedEntrees = entrees.filter((e) => selectedIds.has(e.id));
  const clientObj = clients.find((c) => c.id === Number(clientId));
  const taux = clientObj?.taux_horaire ?? 0;
  const totalMinutes = selectedEntrees.reduce(
    (sum, e) => sum + (e.duree_arrondie_minutes ?? e.duree_minutes ?? 0), 0
  );
  const montantTotal = (totalMinutes / 60) * taux;
  const weekCount = groupByWeek(selectedEntrees).length;
  const willTruncate = weekCount > 8;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!clientId || selectedIds.size === 0 || !numero) return;
    setError(null);
    setSubmitting(true);
    try {
      const date_emission = new Date().toISOString().slice(0, 10);
      const id = await createFacture({ client_id: Number(clientId), numero, date_emission, montant_total: montantTotal });
      await linkEntreesToFacture(id, [...selectedIds]);
      const { pdfBytes, truncated, totalWeeks } = await generatePdf(
        { id, numero, date_emission },
        clientObj,
        selectedEntrees
      );
      downloadPdf(pdfBytes, `${numero}.pdf`);
      setPanelOpen(false);
      if (truncated) setPdfWarning(`Attention : seulement 8 semaines sur ${totalWeeks} ont été incluses dans le PDF.`);
      loadFactures();
    } catch (err) {
      console.error(err);
      setError("Une erreur est survenue. Veuillez réessayer.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDownloadPdf(facture) {
    try {
      const client = clients.find((c) => c.id === facture.client_id);
      if (!client) throw new Error("Client introuvable");
      const entries = await getEntreesParFacture(facture.id);
      const { pdfBytes } = await generatePdf(facture, client, entries);
      downloadPdf(pdfBytes, `${facture.numero}.pdf`);
    } catch (err) {
      console.error(err);
    }
  }

  async function toggleStatut(facture) {
    const next = facture.statut === "payee" ? "impayee" : "payee";
    try {
      await updateFactureStatut(facture.id, next);
      loadFactures();
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <div className="factures-page">
      <div className="factures-page__header">
        <h1 className="factures-page__title">Factures</h1>
        <button className="factures-page__btn-new" onClick={openPanel}>+ Nouvelle facture</button>
      </div>

      {pdfWarning && (
        <p className="factures-page__pdf-warning">{pdfWarning}</p>
      )}

      {factures.length === 0 ? (
        <p className="factures-page__empty">Aucune facture pour le moment.</p>
      ) : (
        <ul className="factures-page__list">
          {factures.map((f) => (
            <li key={f.id} className="factures-page__item">
              <div className="factures-page__item-info">
                <span className="factures-page__item-numero">{f.numero}</span>
                <span className="factures-page__item-client">{f.client_nom}</span>
                <span className="factures-page__item-date">{formatDate(f.date_emission)}</span>
              </div>
              <div className="factures-page__item-right">
                <span className="factures-page__item-montant">{f.montant_total.toFixed(2)} $</span>
                <span className={`factures-page__badge factures-page__badge--${f.statut}`}>
                  {f.statut === "payee" ? "Payée" : "Impayée"}
                </span>
                <button className="factures-page__btn-statut" onClick={() => toggleStatut(f)}>
                  {f.statut === "payee" ? "Marquer impayée" : "Marquer payée"}
                </button>
                <button className="factures-page__btn-pdf" onClick={() => handleDownloadPdf(f)}>
                  📄 PDF
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {panelOpen && (
        <div className="factures-panel__overlay" onClick={() => setPanelOpen(false)}>
          <div className="factures-panel" onClick={(e) => e.stopPropagation()}>
            <div className="factures-panel__header">
              <h2 className="factures-panel__title">Nouvelle facture</h2>
              <button className="factures-panel__close" onClick={() => setPanelOpen(false)} aria-label="Fermer">✕</button>
            </div>

            <form className="factures-panel__form" onSubmit={handleSubmit}>
              <div className="factures-panel__field">
                <label htmlFor="fp-client">Client *</label>
                <select id="fp-client" value={clientId} onChange={(e) => setClientId(e.target.value)}>
                  <option value="">— Choisir —</option>
                  {clients.filter((c) => c.actif).map((c) => (
                    <option key={c.id} value={c.id}>{c.nom}</option>
                  ))}
                </select>
              </div>

              {entrees.length > 0 && (
                <div className="factures-panel__entries">
                  <p className="factures-panel__entries-label">Entrées à facturer</p>
                  <ul className="factures-panel__entries-list">
                    {entrees.map((e) => (
                      <li key={e.id} className="factures-panel__entry">
                        <label className="factures-panel__entry-label">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(e.id)}
                            onChange={() => toggleEntry(e.id)}
                          />
                          <span>{formatDate(e.debut)}</span>
                          <span>{e.projet_nom ?? "—"}</span>
                          <span>{formatDuration(e.duree_arrondie_minutes ?? e.duree_minutes)}</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                  <p className="factures-panel__total">
                    {`Total : ${formatDuration(totalMinutes)}${taux > 0 ? ` — ${montantTotal.toFixed(2)} $` : ""}`}
                  </p>
                </div>
              )}

              {clientId && entrees.length === 0 && (
                <p className="factures-panel__no-entries">Aucune entrée non facturée pour ce client.</p>
              )}

              {willTruncate && (
                <p className="factures-panel__warning">
                  {`${weekCount} semaines détectées — seulement les 8 premières seront dans le PDF.`}
                </p>
              )}

              <div className="factures-panel__field">
                <label htmlFor="fp-numero">Numéro de facture *</label>
                <input
                  id="fp-numero"
                  type="text"
                  value={numero}
                  onChange={(e) => setNumero(e.target.value)}
                  placeholder="F-2026-001"
                />
              </div>

              {error && <p className="factures-panel__error">{error}</p>}

              <button
                type="submit"
                className="factures-panel__btn-submit"
                disabled={!clientId || selectedIds.size === 0 || !numero || submitting}
              >
                {submitting ? "Création…" : "Créer la facture"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
