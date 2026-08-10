import { useState, useEffect } from "react";
import { getClients } from "../db/database";
import ClientCard from "../components/ClientCard";
import ClientPanel from "../components/ClientPanel";
import "./Clients.css";

export default function Clients() {
  const [clients, setClients] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [showNew, setShowNew] = useState(false);

  useEffect(() => {
    loadClients();
  }, []);

  async function loadClients() {
    try {
      const list = await getClients();
      setClients(list);
    } catch (e) {
      console.error(e);
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
    await loadClients();
    setSelectedId(null);
    setShowNew(false);
  }

  return (
    <div className="clients-page">
      <div className="clients-page__toolbar">
        <h1 className="clients-page__title">👥 Clients</h1>
        <button
          className="clients-page__new-btn"
          onClick={() => { setSelectedId(null); setShowNew(true); }}
        >
          + Nouveau client
        </button>
      </div>

      <div className="clients-page__body">
        <div className="clients-page__grid">
          {clients.length === 0 && (
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
      </div>
    </div>
  );
}
