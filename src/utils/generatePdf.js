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

function formatDateFR(isoStr) {
  if (!isoStr) return "";
  const [y, m, d] = isoStr.split("-");
  return `${parseInt(d)}-${parseInt(m)}-${y}`;
}

export async function generatePdf(facture, client, entrees, emetteur = {}) {
  const allWeeks = groupByWeek(entrees);
  const truncated = allWeeks.length > 8;
  const totalWeeks = allWeeks.length;
  const weeks = allWeeks.slice(0, 8);

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([612, 792]);

  const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const BLUE = rgb(0.267, 0.447, 0.769);
  const LGRAY = rgb(0.93, 0.93, 0.93);
  const LBLUE = rgb(0.93, 0.95, 0.99);
  const WHITE = rgb(1, 1, 1);
  const BLACK = rgb(0, 0, 0);
  const DARK = rgb(0.15, 0.15, 0.15);

  const ML = 35;
  const CW = 542;

  // Helper: draw text
  const t = (str, x, y, size = 9, font = regular, color = BLACK) => {
    if (str == null || str === "") return;
    page.drawText(String(str), { x, y, size, font, color });
  };

  // Helper: centered text
  const tc = (str, y, size = 9, font = regular, color = BLACK) => {
    if (str == null || str === "") return;
    const s = String(str);
    const w = font.widthOfTextAtSize(s, size);
    page.drawText(s, { x: ML + CW / 2 - w / 2, y, size, font, color });
  };

  // Helper: filled rect (with optional border)
  const box = (x, y, w, h, fill, borderColor = null) => {
    page.drawRectangle({
      x, y, width: w, height: h,
      color: fill,
      borderColor: borderColor ?? fill,
      borderWidth: borderColor ? 0.5 : 0,
    });
  };

  const nomEmetteur = emetteur.nom || "NOÉMY BIZIER- COMPTABLE";
  const adr1 = emetteur.adresse_ligne1 || "425 RUE DES CHÊNES EST, app. 2";
  const adr2 = emetteur.adresse_ligne2 || "G1J 1K5, QC, QUÉBEC";
  const telEmetteur = emetteur.telephone || "581-999-2355";
  const courrielEmetteur = emetteur.courriel || "noemybizier8@gmail.com";

  // ── HEADER ──────────────────────────────────────────────────
  t(nomEmetteur.toUpperCase(), ML, 755, 14, bold, BLUE);
  t("FACTURE", 430, 748, 34, bold, BLUE);

  t(adr1, ML, 733, 9, regular, DARK);
  t(adr2, ML, 720, 9, regular, DARK);
  t(telEmetteur, ML, 707, 9, bold, DARK);
  t(courrielEmetteur, ML, 694, 9, regular, DARK);

  // N° FACTURE | DATE boxes (right side, aligned with phone/email rows)
  const bx = 380; // box area starts here
  const bw = CW - (bx - ML); // width = 577 - 380 = 197
  const hw = bw / 2; // half width

  // Headers
  box(bx, 700, hw, 24, BLUE); // N° FACTURE header
  box(bx + hw, 700, hw, 24, BLUE); // DATE header
  t("N° FACTURE", bx + 5, 709, 8, bold, WHITE);
  t("DATE", bx + hw + 5, 709, 8, bold, WHITE);

  // Values
  box(bx, 676, hw, 24, WHITE, rgb(0.7, 0.7, 0.7));
  box(bx + hw, 676, hw, 24, WHITE, rgb(0.7, 0.7, 0.7));
  t(facture.numero, bx + 5, 685, 9, bold, BLACK);
  t(formatDateFR(facture.date_emission), bx + hw + 5, 685, 9, regular, BLACK);

  // ── FACTURER À / RÉF CLIENT / CONDITIONS ────────────────────
  const ibTop = 580; // info boxes top y
  const ibHdr = 20; // header height
  const ibBody = 75; // content height
  const cliW = 210;
  const refW = 155;
  const condW = CW - cliW - refW; // = 177

  // Box headers
  box(ML, ibTop - ibHdr, cliW, ibHdr, BLUE);
  box(ML + cliW, ibTop - ibHdr, refW, ibHdr, BLUE);
  box(ML + cliW + refW, ibTop - ibHdr, condW, ibHdr, BLUE);
  t("FACTURER À", ML + 5, ibTop - 14, 9, bold, WHITE);
  t("PERSONNE RÉFÉRENCE", ML + cliW + 5, ibTop - 14, 7.5, bold, WHITE);
  t("CONDITIONS", ML + cliW + refW + 5, ibTop - 14, 9, bold, WHITE);

  // Box bodies
  box(ML, ibTop - ibHdr - ibBody, cliW, ibBody, WHITE, rgb(0.75, 0.75, 0.75));
  box(ML + cliW, ibTop - ibHdr - ibBody, refW, ibBody, WHITE, rgb(0.75, 0.75, 0.75));
  box(ML + cliW + refW, ibTop - ibHdr - ibBody, condW, ibBody, WHITE, rgb(0.75, 0.75, 0.75));

  const cliY = ibTop - ibHdr - 15;
  t(client.nom, ML + 8, cliY, 9, bold, BLACK);
  t(client.courriel, ML + 8, cliY - 13, 8, regular, DARK);
  t(client.telephone, ML + 8, cliY - 26, 8, regular, DARK);
  t(client.adresse, ML + 8, cliY - 39, 8, regular, DARK);

  const refX = ML + cliW + 8;
  t(client.personne_reference, refX, ibTop - ibHdr - 13, 9, bold, BLACK);

  t("5 jours ouvrables", ML + cliW + refW + 8, ibTop - ibHdr - 13, 9, regular, BLACK);

  // ── TABLE ───────────────────────────────────────────────────
  const tblTop = ibTop - ibHdr - ibBody - 12; // small gap after info boxes
  const tblHdrH = 20;
  const rowH = 18;

  const xDesc = ML;
  const xNote = ML + 140;
  const xQty  = ML + 295;
  const xPrix = ML + 345;
  const xMon  = ML + 430;
  const wDesc = 140;
  const wNote = 155;
  const wQty  = 50;
  const wPrix = 85;
  const wMon  = CW - (xMon - ML); // remainder to right edge

  // Table header
  box(ML, tblTop - tblHdrH, CW, tblHdrH, BLUE);
  t("DESCRIPTION", xDesc + 5, tblTop - 14, 9, bold, WHITE);
  t("QTÉ", xQty + 5, tblTop - 14, 9, bold, WHITE);
  t("PRIX UNITAIRE", xPrix + 3, tblTop - 14, 9, bold, WHITE);
  t("MONTANT", xMon + 5, tblTop - 14, 9, bold, WHITE);

  // Vertical column dividers in header
  [xNote, xQty, xPrix, xMon].forEach(x => {
    page.drawLine({ start: {x, y: tblTop - tblHdrH}, end: {x, y: tblTop}, thickness: 0.5, color: rgb(0.5, 0.6, 0.8) });
  });

  // Data rows
  const taux = client.taux_horaire ?? 0;
  let totalMinutesAll = 0;

  for (let i = 0; i < 8; i++) {
    const ry = tblTop - tblHdrH - (i + 1) * rowH;
    if (i % 2 === 1) box(ML, ry, CW, rowH, LBLUE);
    page.drawLine({ start: {x: ML, y: ry}, end: {x: ML + CW, y: ry}, thickness: 0.3, color: rgb(0.8, 0.8, 0.8) });

    if (i < weeks.length) {
      const g = weeks[i];
      const notes = g.entries.map(e => e.note).filter(Boolean).join(" / ");
      const mins = g.entries.reduce((s, e) => s + (e.duree_arrondie_minutes ?? e.duree_minutes ?? 0), 0);
      totalMinutesAll += mins;
      const hrs = (mins / 60).toFixed(2);
      const montant = ((mins / 60) * taux).toFixed(2);

      t(formatWeekLabel(g.monday), xDesc + 5, ry + 5, 8, regular, BLACK);
      t(notes, xNote + 5, ry + 5, 8, regular, BLACK);
      t(hrs, xQty + 5, ry + 5, 8, regular, BLACK);
      t(String(taux), xPrix + 5, ry + 5, 8, regular, BLACK);
      t(montant, xMon + 5, ry + 5, 8, regular, BLACK);
    }
  }

  const tblBottom = tblTop - tblHdrH - 8 * rowH;
  const sousTotal = ((totalMinutesAll / 60) * taux).toFixed(2);

  // SOUS-TOTAL row
  box(ML, tblBottom - 22, CW, 22, LGRAY);
  t("SOUS-TOTAL", xQty + 5, tblBottom - 15, 9, bold, BLACK);
  t(sousTotal, xMon + 5, tblBottom - 15, 9, regular, BLACK);

  // TOTAL row
  box(ML, tblBottom - 44, CW, 22, BLUE);
  t("TOTAL", xQty + 5, tblBottom - 37, 10, bold, WHITE);
  t(sousTotal + " $", xMon + 5, tblBottom - 37, 10, bold, WHITE);

  // Outer table border
  page.drawRectangle({
    x: ML, y: tblBottom - 44, width: CW, height: tblTop - (tblBottom - 44),
    borderColor: rgb(0.6, 0.6, 0.6), borderWidth: 0.5, color: undefined,
  });

  // ── FOOTER ──────────────────────────────────────────────────
  const fy = 95;
  tc("Pour toute question concernant cette facture, veuillez contacter", fy + 30, 8, regular, DARK);
  tc(nomEmetteur.toUpperCase(), fy + 16, 10, bold, DARK);
  tc(telEmetteur, fy + 3, 9, bold, DARK);
  tc(courrielEmetteur, fy - 10, 9, regular, DARK);

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
