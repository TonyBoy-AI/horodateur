import { describe, it, expect } from "vitest";
import { groupByWeek, formatWeekLabel } from "../src/utils/generatePdf";

const localStr = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

describe("groupByWeek", () => {
  it("groupe des entrées de la même semaine ISO", () => {
    const entrees = [
      { id: 1, debut: "2026-08-10T09:00:00", duree_arrondie_minutes: 60, note: null },
      { id: 2, debut: "2026-08-12T14:00:00", duree_arrondie_minutes: 90, note: "Test" },
    ];
    const groups = groupByWeek(entrees);
    expect(groups).toHaveLength(1);
    expect(groups[0].entries).toHaveLength(2);
    expect(localStr(groups[0].monday)).toBe("2026-08-10");
  });

  it("sépare les entrées de semaines différentes", () => {
    const entrees = [
      { id: 1, debut: "2026-08-10T09:00:00", duree_arrondie_minutes: 60, note: null },
      { id: 2, debut: "2026-08-17T09:00:00", duree_arrondie_minutes: 90, note: null },
    ];
    expect(groupByWeek(entrees)).toHaveLength(2);
  });

  it("trie les semaines chronologiquement (plus ancien en premier)", () => {
    const entrees = [
      { id: 2, debut: "2026-08-17T09:00:00", duree_arrondie_minutes: 90, note: null },
      { id: 1, debut: "2026-08-10T09:00:00", duree_arrondie_minutes: 60, note: null },
    ];
    const groups = groupByWeek(entrees);
    expect(localStr(groups[0].monday)).toBe("2026-08-10");
    expect(localStr(groups[1].monday)).toBe("2026-08-17");
  });

  it("place le dimanche dans la semaine du lundi précédent", () => {
    // 2026-08-16 est un dimanche → lundi 2026-08-10
    const entrees = [
      { id: 1, debut: "2026-08-16T23:00:00", duree_arrondie_minutes: 30, note: null },
    ];
    const groups = groupByWeek(entrees);
    expect(localStr(groups[0].monday)).toBe("2026-08-10");
  });

  it("retourne un tableau vide si aucune entrée", () => {
    expect(groupByWeek([])).toEqual([]);
  });
});

describe("formatWeekLabel", () => {
  it("génère le label correct pour une semaine en août", () => {
    // 2026-08-10 est un lundi, dimanche = 2026-08-16
    const monday = new Date(2026, 7, 10);
    expect(formatWeekLabel(monday)).toBe("semaine du 10 août au 16 août");
  });

  it("génère le label correct quand la semaine chevauche deux mois", () => {
    // 2026-08-31 est un lundi, dimanche = 2026-09-06
    const monday = new Date(2026, 7, 31);
    expect(formatWeekLabel(monday)).toBe("semaine du 31 août au 6 sept.");
  });
});
