// src/data/gaLocations.js
// 3-level hierarchy: GA Location → City → Area
// Default is empty — Admin adds GA Locations via Access → GA Locations panel

export const gaLocations = [];


// ── Flatten helpers ──────────────────────────────────────────────────────────

export const getAllCities = () =>
  gaLocations.flatMap(ga =>
    ga.cities.map(c => ({ ...c, gaId: ga.id, gaLabel: ga.label }))
  );

export const getAllAreas = () =>
  gaLocations.flatMap(ga =>
    ga.cities.flatMap(c =>
      c.areas.map(a => ({
        area: a,
        cityId: c.id,
        cityLabel: c.label,
        gaId: ga.id,
        gaLabel: ga.label,
      }))
    )
  );

export const getAreasForCity = (cityId) => {
  for (const ga of gaLocations) {
    const city = ga.cities.find(c => c.id === cityId);
    if (city) return city.areas;
  }
  return [];
};

export const getCitiesForGA = (gaId) => {
  const ga = gaLocations.find(g => g.id === gaId);
  return ga ? ga.cities : [];
};

export const getGALabel = (gaId) => {
  const ga = gaLocations.find(g => g.id === gaId);
  return ga ? ga.label : gaId;
};

export const getCityLabel = (cityId) => {
  for (const ga of gaLocations) {
    const city = ga.cities.find(c => c.id === cityId);
    if (city) return city.label;
  }
  return cityId;
};
