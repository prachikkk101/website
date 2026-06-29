// src/data/gaLocations.js
// 3-level hierarchy: GA Location → City → Area

export const gaLocations = [
  {
    id: 'sirsa',
    label: 'Sirsa',
    cities: [
      {
        id: 'sirsa_city',
        label: 'Sirsa',
        areas: ['Model Town', 'Sector 12', 'Civil Lines', 'Old City'],
      },
      {
        id: 'dabwali',
        label: 'Dabwali',
        areas: ['Dabwali Road', 'Ward 1', 'Ward 2', 'Main Market'],
      },
      {
        id: 'mansa',
        label: 'Mansa',
        areas: ['Mansa City', 'Bus Stand Area'],
      },
    ],
  },
  {
    id: 'hisar',
    label: 'Hisar',
    cities: [
      {
        id: 'hisar_city',
        label: 'Hisar',
        areas: ['UE-II', 'PLA Colony', 'Guru Nanak Nagar', 'Uttam Nagar', 'Sector 13', 'Model Town'],
      },
    ],
  },
  {
    id: 'ludhiana',
    label: 'Ludhiana',
    cities: [
      {
        id: 'khanna',
        label: 'Khanna',
        areas: ['CA-09', 'Kishangar Village', 'Highway Halt', 'Kohara CA-07'],
      },
    ],
  },
];

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
