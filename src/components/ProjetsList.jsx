import { useState } from "react";
import { createProjet, updateProjet, deleteProjet } from "../db/database";
import "./ProjetsList.css";

export default function ProjetsList({ clientId, projets, onRefresh }) {
  const [editingId, setEditingId] = useState(null);
  const [editValues, setEditValues] = useState({ nom: "", taux_horaire: "" });
  const [newProjet, setNewProjet] = useState(null);

  function startEdit(p) {
    setEditingId(p.id);
    setEditValues({ nom: p.nom, taux_horaire: p.taux_horaire ?? "" });
  }

  async function saveEdit(id) {
    await updateProjet(id, {
      nom: editValues.nom.trim(),
      taux_horaire: editValues.taux_horaire !== "" ? Number(editValues.taux_horaire) : null,
    });
    setEditingId(null);
    onRefresh();
  }

  async function handleDelete(id) {
    if (!window.confirm("Supprimer ce projet ?")) return;
    await deleteProjet(id);
    onRefresh();
  }

  async function handleAdd() {
    if (!newProjet?.nom?.trim()) return;
    await createProjet({
      client_id: clientId,
      nom: newProjet.nom.trim(),
      taux_horaire: newProjet.taux_horaire !== "" ? Number(newProjet.taux_horaire) : null,
    });
    setNewProjet(null);
    onRefresh();
  }

  return (
    <div className="projets-list">
      <div className="projets-list__header">
        <span>📁 Projets</span>
        <button
          className="projets-list__add-btn"
          onClick={() => setNewProjet({ nom: "", taux_horaire: "" })}
        >
          + Ajouter
        </button>
      </div>

      {projets.map((p) =>
        editingId === p.id ? (
          <div key={p.id} className="projets-list__row projets-list__row--editing">
            <input
              className="projets-list__input"
              value={editValues.nom}
              onChange={(e) => setEditValues({ ...editValues, nom: e.target.value })}
              placeholder="Nom du projet"
            />
            <input
              className="projets-list__input projets-list__input--rate"
              type="number"
              min="0"
              step="0.5"
              value={editValues.taux_horaire}
              onChange={(e) => setEditValues({ ...editValues, taux_horaire: e.target.value })}
              placeholder="Taux"
            />
            <button className="projets-list__btn projets-list__btn--confirm" onClick={() => saveEdit(p.id)}>✓</button>
            <button className="projets-list__btn" onClick={() => setEditingId(null)}>✕</button>
          </div>
        ) : (
          <div key={p.id} className="projets-list__row">
            <span className="projets-list__name">{p.nom}</span>
            <span className="projets-list__rate">
              {p.taux_horaire != null ? `${p.taux_horaire} $/h` : <em>hérite du client</em>}
            </span>
            <button className="projets-list__btn" onClick={() => startEdit(p)}>✏️</button>
            <button className="projets-list__btn" onClick={() => handleDelete(p.id)}>🗑️</button>
          </div>
        )
      )}

      {newProjet && (
        <div className="projets-list__row projets-list__row--editing">
          <input
            className="projets-list__input"
            value={newProjet.nom}
            onChange={(e) => setNewProjet({ ...newProjet, nom: e.target.value })}
            placeholder="Nom du projet"
            autoFocus
          />
          <input
            className="projets-list__input projets-list__input--rate"
            type="number"
            min="0"
            step="0.5"
            value={newProjet.taux_horaire}
            onChange={(e) => setNewProjet({ ...newProjet, taux_horaire: e.target.value })}
            placeholder="Taux"
          />
          <button className="projets-list__btn projets-list__btn--confirm" onClick={handleAdd}>✓</button>
          <button className="projets-list__btn" onClick={() => setNewProjet(null)}>✕</button>
        </div>
      )}

      {projets.length === 0 && !newProjet && (
        <p className="projets-list__empty">Aucun projet — clique "+ Ajouter" 🌱</p>
      )}
    </div>
  );
}
