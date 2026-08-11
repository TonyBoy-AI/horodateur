import { useState, useEffect } from "react";
import { getParametre, setParametre } from "../db/database";
import "./Parametres.css";

export default function Parametres() {
  const [nomEntreprise, setNomEntreprise] = useState("");
  const [arrondi, setArrondi] = useState(null);
  const [rappel, setRappel] = useState(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    Promise.all([
      getParametre("nom_entreprise"),
      getParametre("arrondi_minutes"),
      getParametre("rappel_inactivite_heures"),
    ])
      .then(([nom, arr, rap]) => {
        setNomEntreprise(nom ?? "");
        setArrondi(arr ?? "15");
        setRappel(rap ?? "4");
      })
      .catch(console.error);
  }, []);

  async function save(cle, valeur) {
    await setParametre(cle, valeur).catch(console.error);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  return (
    <div className="parametres-page">
      <h1 className="parametres-page__title">⚙️ Paramètres</h1>

      {saved && (
        <p className="parametres-page__saved" role="status">
          ✓ Sauvegardé
        </p>
      )}

      <section className="parametres-page__section">
        <h2 className="parametres-page__section-title">Entreprise</h2>
        <div className="parametres-page__field">
          <label htmlFor="p-nom">Nom de l'entreprise</label>
          <input
            id="p-nom"
            type="text"
            value={nomEntreprise}
            onChange={(e) => setNomEntreprise(e.target.value)}
            onBlur={() => save("nom_entreprise", nomEntreprise)}
            placeholder="Ex: Studio Créatif"
          />
        </div>
      </section>

      <section className="parametres-page__section">
        <h2 className="parametres-page__section-title">Chronomètre</h2>

        <div className="parametres-page__field">
          <label htmlFor="p-arrondi">Arrondi des durées</label>
          <select
            id="p-arrondi"
            value={arrondi ?? "15"}
            onChange={(e) => {
              setArrondi(e.target.value);
              save("arrondi_minutes", e.target.value);
            }}
          >
            <option value="1">1 minute (aucun arrondi)</option>
            <option value="5">5 minutes</option>
            <option value="10">10 minutes</option>
            <option value="15">15 minutes</option>
            <option value="30">30 minutes</option>
            <option value="60">1 heure</option>
          </select>
        </div>

        <div className="parametres-page__field">
          <label htmlFor="p-rappel">Rappel d'inactivité</label>
          <select
            id="p-rappel"
            value={rappel ?? "4"}
            onChange={(e) => {
              setRappel(e.target.value);
              save("rappel_inactivite_heures", e.target.value);
            }}
          >
            <option value="0">Désactivé</option>
            <option value="1">1 heure</option>
            <option value="2">2 heures</option>
            <option value="4">4 heures</option>
            <option value="8">8 heures</option>
          </select>
        </div>
      </section>
    </div>
  );
}
