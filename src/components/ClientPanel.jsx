import { useState, useEffect } from "react";
import { createClient, updateClient, deleteClient, getProjetsByClient } from "../db/database";
import ProjetsList from "./ProjetsList";
import "./ClientPanel.css";

const SWATCHES = [
  "#7FD8A0", "#a8dadc", "#f4a261", "#e76f51",
  "#ffd166", "#06d6a0", "#118ab2", "#c77dff",
  "#f72585", "#b5838d",
];

const EMPTY_FORM = {
  nom: "",
  taux_horaire: "",
  courriel: "",
  adresse: "",
  couleur: "#7FD8A0",
  actif: true,
};

export default function ClientPanel({ client, onClose, onSaved, onDeleted }) {
  const isNew = !client;
  const [form, setForm] = useState(EMPTY_FORM);
  const [projets, setProjets] = useState([]);

  useEffect(() => {
    if (client) {
      setForm({
        nom: client.nom,
        taux_horaire: client.taux_horaire,
        courriel: client.courriel ?? "",
        adresse: client.adresse ?? "",
        couleur: client.couleur ?? "#7FD8A0",
        actif: Boolean(client.actif),
      });
      loadProjets();
    } else {
      setForm(EMPTY_FORM);
      setProjets([]);
    }
  }, [client?.id]);

  async function loadProjets() {
    if (!client) return;
    const list = await getProjetsByClient(client.id);
    setProjets(list);
  }

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSave() {
    if (!form.nom.trim() || form.taux_horaire === "") return;
    const data = { ...form, taux_horaire: Number(form.taux_horaire) };
    if (isNew) {
      const id = await createClient(data);
      onSaved(id);
    } else {
      await updateClient(client.id, data);
      onSaved(client.id);
    }
  }

  async function handleDelete() {
    if (
      !window.confirm(
        `Supprimer ${client.nom} ? Toutes ses entrées de temps seront perdues.`
      )
    )
      return;
    await deleteClient(client.id);
    onDeleted();
  }

  return (
    <aside className="client-panel">
      <div className="client-panel__header">
        <h2 className="client-panel__title">
          {isNew ? "✨ Nouveau client" : `✏️ ${form.nom || "Client"}`}
        </h2>
        <button className="client-panel__close" onClick={onClose} aria-label="Fermer">
          ✕
        </button>
      </div>

      <div className="client-panel__body">
        <div className="client-panel__field">
          <label>Nom *</label>
          <input
            value={form.nom}
            onChange={(e) => set("nom", e.target.value)}
            placeholder="Nom du client"
          />
        </div>

        <div className="client-panel__field">
          <label>Taux horaire ($/h) *</label>
          <input
            type="number"
            min="0"
            step="0.5"
            value={form.taux_horaire}
            onChange={(e) => set("taux_horaire", e.target.value)}
            placeholder="ex. 75"
          />
        </div>

        <div className="client-panel__field">
          <label>Courriel</label>
          <input
            type="email"
            value={form.courriel}
            onChange={(e) => set("courriel", e.target.value)}
            placeholder="info@client.ca"
          />
        </div>

        <div className="client-panel__field">
          <label>Adresse</label>
          <textarea
            rows={2}
            value={form.adresse}
            onChange={(e) => set("adresse", e.target.value)}
            placeholder="123 rue Exemple, Montréal"
          />
        </div>

        <div className="client-panel__field">
          <label>Couleur</label>
          <div className="client-panel__swatches">
            {SWATCHES.map((c) => (
              <button
                key={c}
                type="button"
                className={`client-panel__swatch${form.couleur === c ? " client-panel__swatch--active" : ""}`}
                style={{ background: c }}
                onClick={() => set("couleur", c)}
                aria-label={c}
              />
            ))}
          </div>
        </div>

        <div className="client-panel__field client-panel__field--row">
          <label>Actif</label>
          <button
            type="button"
            className={`client-panel__toggle${form.actif ? " client-panel__toggle--on" : ""}`}
            onClick={() => set("actif", !form.actif)}
          >
            {form.actif ? "✓ Oui" : "✗ Non"}
          </button>
        </div>

        {!isNew && (
          <ProjetsList clientId={client.id} projets={projets} onRefresh={loadProjets} />
        )}
      </div>

      <div className="client-panel__footer">
        <button className="client-panel__save" onClick={handleSave}>
          💾 Sauvegarder
        </button>
        {!isNew && (
          <button className="client-panel__delete" onClick={handleDelete}>
            🗑️ Supprimer ce client
          </button>
        )}
      </div>
    </aside>
  );
}
