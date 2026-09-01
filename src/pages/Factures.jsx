import { useState, useEffect } from "react";
import {
  getClients,
  getFactures,
  getEntreesSansFacture,
  createFacture,
  linkEntreesToFacture,
  updateFactureStatut,
  updateFactureStatutEtMontant,
  getEntreesParFacture,
  getParametre,
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
  const [payModal, setPayModal] = useState(null); // { facture } | null
  const [montantSaisi, setMontantSaisi] = useState("");

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
    setPdfWarning(null);
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

  async function loadEmetteur() {
    const [nom, adr1, adr2, tel, courriel] = await Promise.all([
      getParametre("nom_entreprise"),
      getParametre("adresse_ligne1"),
      getParametre("adresse_ligne2"),
      getParametre("telephone_entreprise"),
      getParametre("courriel_entreprise"),
    ]);
    return { nom, adresse_ligne1: adr1, adresse_ligne2: adr2, telephone: tel, courriel };
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!clientId || selectedIds.size === 0 || !numero) return;
    setError(null);
    setSubmitting(true);
    try {
      const date_emission = new Date().toISOString().slice(0, 10);
      const id = await createFacture({ client_id: Number(clientId), numero, date_emission, montant_total: montantTotal });
      await linkEntreesToFacture(id, [...selectedIds]);
      setPanelOpen(false);
      loadFactures();
      try {
        const emetteur = await loadEmetteur();
        const { pdfBytes, truncated, totalWeeks } = await generatePdf(
          { id, numero, date_emission },
          clientObj,
          selectedEntrees,
          emetteur
        );
        downloadPdf(pdfBytes, `${numero}.pdf`);
        if (truncated) setPdfWarning(`Attention : seulement 8 semaines sur ${totalWeeks} ont été incluses dans le PDF.`);
      } catch (pdfErr) {
        console.error(pdfErr);
        setPdfWarning(`La facture ${numero} a été créée. Le PDF n'a pas pu être généré — utilisez le bouton 📄 PDF pour réessayer.`);
      }
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
      const emetteur = await loadEmetteur();
      const { pdfBytes } = await generatePdf(facture, client, entries, emetteur);
      downloadPdf(pdfBytes, `${facture.numero}.pdf`);
    } catch (err) {
      console.error(err);
    }
  }

  function handleClickStatut(facture) {
    if (facture.statut === "payee") {
      // Marquer impayée directement, reset montant_paye
      updateFactureStatutEtMontant(facture.id, "impayee", null)
        .then(loadFactures)
        .catch(console.error);
    } else {
      // Ouvrir le modal de confirmation du montant
      setMontantSaisi(facture.montant_total.toFixed(2));
      setPayModal({ facture });
    }
  }

  async function confirmerPaiement() {
    if (!payModal) return;
    const montant = parseFloat(montantSaisi.replace(",", "."));
    if (isNaN(montant) || montant < 0) return;
    try {
      await updateFactureStatutEtMontant(payModal.facture.id, "payee", montant);
      setPayModal(null);
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
                <span className="factures-page__item-montant">
                  {(f.montant_paye ?? f.montant_total).toFixed(2)} $
                </span>
                <span className={`factures-page__badge factures-page__badge--${f.statut}`}>
                  {f.statut === "payee" ? "Payée" : "Impayée"}
                </span>
                <button className="factures-page__btn-statut" onClick={() => handleClickStatut(f)}>
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

      {payModal && (() => {
        const montant = parseFloat(montantSaisi.replace(",", "."));
        const total = payModal.facture.montant_total;
        const diff = isNaN(montant) ? null : montant - total;
        const diffStr = diff != null && Math.abs(diff) >= 0.01
          ? `${diff >= 0 ? "+" : ""}${diff.toFixed(2)} $`
          : null;
        return (
          <div className="pay-modal__overlay" onClick={() => setPayModal(null)}>
            <div className="pay-modal" onClick={(e) => e.stopPropagation()}>
              <h2 className="pay-modal__title">Confirmer le paiement</h2>
              <p className="pay-modal__facture">{payModal.facture.numero} — {payModal.facture.client_nom}</p>
              <div className="pay-modal__field">
                <label htmlFor="pay-montant">Montant reçu ($)</label>
                <input
                  id="pay-montant"
                  type="number"
                  step="0.01"
                  min="0"
                  value={montantSaisi}
                  onChange={(e) => setMontantSaisi(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="pay-modal__recap">
                <span>Montant facturé</span>
                <span>{total.toFixed(2)} $</span>
              </div>
              {diffStr && (
                <div className="pay-modal__recap pay-modal__recap--diff">
                  <span>Arrondissement</span>
                  <span>{diffStr}</span>
                </div>
              )}
              <div className="pay-modal__actions">
                <button className="pay-modal__btn pay-modal__btn--cancel" onClick={() => setPayModal(null)}>
                  Annuler
                </button>
                <button
                  className="pay-modal__btn pay-modal__btn--confirm"
                  onClick={confirmerPaiement}
                  disabled={isNaN(montant) || montant < 0}
                >
                  Confirmer payée
                </button>
              </div>
            </div>
          </div>
        );
      })()}

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
