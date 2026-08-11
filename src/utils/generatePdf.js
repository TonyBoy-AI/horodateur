const MOIS_FR = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

function getMonday(dateStr) {
  const d = new Date(dateStr);
  const day = d.getDay(); // 0=dim, 1=lun, ..., 6=sam
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

export async function generatePdf(facture, client, entrees) {
  throw new Error("Not yet implemented — see Task 4");
}

export function downloadPdf(pdfBytes, filename) {
  throw new Error("Not yet implemented — see Task 4");
}
