import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const MOIS_FR = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

function getMonday(dateStr) {
  const d = new Date(dateStr);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function localKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function groupByWeek(entrees) {
  const map = new Map();
  for (const e of entrees) {
    const monday = getMonday(e.debut);
    const key = localKey(monday);
    if (!map.has(key)) map.set(key, { monday, entries: [] });
    map.get(key).entries.push(e);
  }
  return [...map.values()].sort((a, b) => a.monday - b.monday);
}

export function formatWeekLabel(monday) {
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);
  const fmt = (d) => `${d.getDate()} ${MOIS_FR[d.getMonth()]}`;
  return `semaine du ${fmt(monday)} au ${fmt(sunday)}`;
}

// Coordonnées en points (72pt = 1 pouce), origine bas-gauche.
// Valeurs initiales — à calibrer visuellement via le bouton Calibration PDF dans l'app.
const COORDS = {
  numero:        { x: 390, y: 703 },
  date:          { x: 498, y: 703 },
  nomEntreprise: { x: 42,  y: 636 },
  courriel:      { x: 42,  y: 619 },
  telephone:     { x: 42,  y: 602 },
  adresse:       { x: 42,  y: 585 },
  persRef:       { x: 374, y: 636 },
  tableFirstY:   474,
  tableRowH:     17.5,
  colDesc:       42,
  colNote:       185,
  colQty:        358,
  colPrix:       420,
  colMontant:    500,
  soustotal:     { x: 500, y: 118 },
  total:         { x: 500, y: 96  },
};

export async function generatePdf(facture, client, entrees) {
  const allWeeks = groupByWeek(entrees);
  const truncated = allWeeks.length > 8;
  const totalWeeks = allWeeks.length;
  const weeks = allWeeks.slice(0, 8);

  const resp = await fetch("/template-facture.pdf");
  if (!resp.ok) throw new Error("Template PDF introuvable");
  const arrayBuffer = await resp.arrayBuffer();

  const pdfDoc = await PDFDocument.load(arrayBuffer);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const page = pdfDoc.getPages()[0];
  const fontSize = 9;
  const black = rgb(0, 0, 0);

  const draw = (text, x, y) => {
    if (!text) return;
    page.drawText(String(text), { x, y, size: fontSize, font, color: black });
  };

  draw(facture.numero, COORDS.numero.x, COORDS.numero.y);
  draw(facture.date_emission, COORDS.date.x, COORDS.date.y);
  draw(client.nom, COORDS.nomEntreprise.x, COORDS.nomEntreprise.y);
  draw(client.courriel, COORDS.courriel.x, COORDS.courriel.y);
  draw(client.telephone, COORDS.telephone.x, COORDS.telephone.y);
  draw(client.adresse, COORDS.adresse.x, COORDS.adresse.y);
  draw(client.personne_reference, COORDS.persRef.x, COORDS.persRef.y);

  const taux = client.taux_horaire ?? 0;
  let totalMinutesAll = 0;

  weeks.forEach((group, i) => {
    const y = COORDS.tableFirstY - i * COORDS.tableRowH;
    const notes = group.entries.map((e) => e.note).filter(Boolean).join(" / ");
    const totalMinutes = group.entries.reduce(
      (s, e) => s + (e.duree_arrondie_minutes ?? e.duree_minutes ?? 0), 0
    );
    totalMinutesAll += totalMinutes;
    const heures = (totalMinutes / 60).toFixed(2);
    const montant = ((totalMinutes / 60) * taux).toFixed(2);

    draw(formatWeekLabel(group.monday), COORDS.colDesc, y);
    draw(notes, COORDS.colNote, y);
    draw(heures, COORDS.colQty, y);
    draw(String(taux), COORDS.colPrix, y);
    draw(montant, COORDS.colMontant, y);
  });

  const sousTotal = ((totalMinutesAll / 60) * taux).toFixed(2);
  draw(sousTotal, COORDS.soustotal.x, COORDS.soustotal.y);
  draw(sousTotal, COORDS.total.x, COORDS.total.y);

  const pdfBytes = await pdfDoc.save();
  return { pdfBytes, truncated, totalWeeks };
}

export function downloadPdf(pdfBytes, filename) {
  const blob = new Blob([pdfBytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
