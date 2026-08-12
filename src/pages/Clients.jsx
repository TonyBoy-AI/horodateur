import { useState, useEffect } from "react";
import { getClients, getFacturesParClient } from "../db/database";
import ClientCard from "../components/ClientCard";
import ClientPanel from "../components/ClientPanel";
import ClientFacturesPanel from "../components/ClientFacturesPanel";
import "./Clients.css";

export default function Clients() {
  const [clients, setClients] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [factures, setFactures] = useState([]);

  useEffect(() => {
    loadClients();
  }, []);

  useEffect(() => {
    if (!selectedId) { setFactures([]); return; }
    getFacturesParClient(selectedId).then(setFactures).catch(console.error);
  }, [selectedId]);

  async function loadClients() {
    setLoadError(null);
    try {
      const list = await getClients();
      setClients(list);
    } catch (e) {
      console.error(e);
      setLoadError("Impossible de charger les clients.");
    }
  }

  const selectedClient = clients.find((c) => c.id === selectedId) ?? null;
  const panelClient = showNew ? null : selectedClient;
  const showPanel = showNew || selectedId !== null;

  function handleCardClick(id) {
    setShowNew(false);
    setSelectedId((prev) => (prev === id ? null : id));
  }

  function handleClose() {
    setSelectedId(null);
    setShowNew(false);
  }

  async function handleSaved(id) {
    await loadClients();
    setShowNew(false);
    setSelectedId(id);
  }

  async function handleDeleted() {
    setSelectedId(null);
    setShowNew(false);
    await loadClients();
  }

  function handleNewClick() {
    setSelectedId(null);
    setShowNew(true);
  }

  return (
    <div className="clients-page">
      <div className="clients-page__toolbar">
        <h1 className="clients-page__title">👥 Clients</h1>
        <button className="clients-page__new-btn" onClick={handleNewClick}>
          + Nouveau client
        </button>
      </div>

      <div className="clients-page__body">
        <div className="clients-page__grid">
          {loadError && <p className="clients-page__error">{loadError}</p>}
          {!loadError && clients.length === 0 && (
            <p className="clients-page__empty">
              Aucun client pour l'instant — crée-en un ! 🌱
            </p>
          )}
          {clients.map((c) => (
            <ClientCard
              key={c.id}
              client={c}
              isSelected={c.id === selectedId}
              onClick={() => handleCardClick(c.id)}
            />
          ))}
        </div>

        {showPanel && (
          <ClientPanel
            client={panelClient}
            onClose={handleClose}
            onSaved={handleSaved}
            onDeleted={handleDeleted}
          />
        )}

        {selectedId !== null && selectedClient && (
          <ClientFacturesPanel client={selectedClient} factures={factures} />
        )}
      </div>
    </div>
  );
}
