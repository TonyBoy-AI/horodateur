import { useState, useEffect } from "react";
import { getParametre, setParametre } from "../db/database";
import "./Parametres.css";

export default function Parametres() {
  const [nomEntreprise, setNomEntreprise] = useState("");
  const [adresseLigne1, setAdresseLigne1] = useState("");
  const [adresseLigne2, setAdresseLigne2] = useState("");
  const [telephone, setTelephone] = useState("");
  const [courriel, setCourriel] = useState("");
  const [arrondi, setArrondi] = useState("15");
  const [rappel, setRappel] = useState("4");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    Promise.all([
      getParametre("nom_entreprise"),
      getParametre("adresse_ligne1"),
      getParametre("adresse_ligne2"),
      getParametre("telephone_entreprise"),
      getParametre("courriel_entreprise"),
      getParametre("arrondi_minutes"),
      getParametre("rappel_inactivite_heures"),
    ])
      .then(([nom, adr1, adr2, tel, courl, arr, rap]) => {
        setNomEntreprise(nom ?? "");
        setAdresseLigne1(adr1 ?? "");
        setAdresseLigne2(adr2 ?? "");
        setTelephone(tel ?? "");
        setCourriel(courl ?? "");
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
            placeholder="Ex: Noémy Bizier - Comptable"
          />
        </div>
        <div className="parametres-page__field">
          <label htmlFor="p-adr1">Adresse (ligne 1)</label>
          <input
            id="p-adr1"
            type="text"
            value={adresseLigne1}
            onChange={(e) => setAdresseLigne1(e.target.value)}
            onBlur={() => save("adresse_ligne1", adresseLigne1)}
            placeholder="Ex: 425 rue des Chênes Est, app. 2"
          />
        </div>
        <div className="parametres-page__field">
          <label htmlFor="p-adr2">Adresse (ligne 2)</label>
          <input
            id="p-adr2"
            type="text"
            value={adresseLigne2}
            onChange={(e) => setAdresseLigne2(e.target.value)}
            onBlur={() => save("adresse_ligne2", adresseLigne2)}
            placeholder="Ex: G1J 1K5, QC, Québec"
          />
        </div>
        <div className="parametres-page__field">
          <label htmlFor="p-tel">Téléphone</label>
          <input
            id="p-tel"
            type="text"
            value={telephone}
            onChange={(e) => setTelephone(e.target.value)}
            onBlur={() => save("telephone_entreprise", telephone)}
            placeholder="Ex: 581-999-2355"
          />
        </div>
        <div className="parametres-page__field">
          <label htmlFor="p-courriel">Courriel</label>
          <input
            id="p-courriel"
            type="email"
            value={courriel}
            onChange={(e) => setCourriel(e.target.value)}
            onBlur={() => save("courriel_entreprise", courriel)}
            placeholder="Ex: noemybizier8@gmail.com"
          />
        </div>
      </section>

      <section className="parametres-page__section">
        <h2 className="parametres-page__section-title">Chronomètre</h2>

        <div className="parametres-page__field">
          <label htmlFor="p-arrondi">Arrondi des durées</label>
          <select
            id="p-arrondi"
            value={arrondi}
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
            value={rappel}
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
