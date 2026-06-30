// src/components/SiteFlyoutMenu.jsx
import { useState, useRef } from 'react';

function SiteFlyoutMenu({ gaLocations, onSelect, selectedLabel }) {
  // gaLocations structure:
  // [{ id, name, cities: [{ id, name, areas: ['sec1','sec2'] }] }]

  const [activeGA,   setActiveGA]   = useState(null); // null = closed, 'open' = open but no GA selected
  const [activeCity, setActiveCity] = useState(null);
  const closeTimer = useRef(null);

  const cancelClose = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };

  const scheduleClose = () => {
    closeTimer.current = setTimeout(() => {
      setActiveGA(null);
      setActiveCity(null);
    }, 200);
  };

  const currentGA   = (gaLocations || []).find(g => g.name === activeGA);
  const currentCity = currentGA?.cities?.find(c => c.name === activeCity);

  return (
    <div
      style={{ position: 'relative', display: 'inline-block' }}
      onMouseEnter={() => {
        cancelClose();
        if (activeGA === null) setActiveGA('open');
      }}
      onMouseLeave={scheduleClose}
    >
      {/* Trigger button */}
      <button style={{
        height: '32px', padding: '0 12px',
        background: 'white', border: '1px solid #d1d5db',
        borderRadius: '4px', fontSize: '12px', cursor: 'pointer',
        color: '#374151', display: 'flex', alignItems: 'center', gap: '4px',
        maxWidth: '220px', whiteSpace: 'nowrap', overflow: 'hidden'
      }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {selectedLabel || 'All GA'}
        </span>
        {' '}▾
      </button>

      {/* Flyout panel — only mounted when open */}
      {activeGA !== null && (
        <div
          style={{
            position: 'absolute', top: '100%', left: 0,
            background: 'white', border: '1px solid #e2e8f0',
            borderRadius: '6px', boxShadow: '0 6px 20px rgba(0,0,0,0.18)',
            zIndex: 9999, marginTop: '4px',
            display: 'flex', isolation: 'isolate'
          }}
          onMouseEnter={cancelClose}
        >
          {/* ── Column 1: GA Locations ── */}
          <div style={{ minWidth: '160px', borderRight: '1px solid #e2e8f0' }}>
            {/* Reset / All GA row */}
            <div
              onClick={() => { onSelect(null, null, null); setActiveGA(null); setActiveCity(null); }}
              onMouseEnter={() => { cancelClose(); setActiveGA('open'); setActiveCity(null); }}
              style={{
                padding: '10px 14px', fontSize: '13px', cursor: 'pointer',
                color: '#1f4e1a', fontWeight: 700,
                borderBottom: '1px solid #f1f5f9',
                background: activeGA === 'open' ? '#f0f7ee' : 'white'
              }}
            >
              All GA
            </div>

            {(!gaLocations || gaLocations.length === 0) && (
              <div style={{ padding: '10px 14px', fontSize: '12px', color: '#94a3b8' }}>
                No GA locations added yet
              </div>
            )}

            {(gaLocations || []).map(ga => (
              <div
                key={ga.id || ga.name}
                onMouseEnter={() => { cancelClose(); setActiveGA(ga.name); setActiveCity(null); }}
                style={{
                  padding: '10px 14px', fontSize: '13px', cursor: 'pointer',
                  background: activeGA === ga.name ? '#f0f7ee' : 'white',
                  color: activeGA === ga.name ? '#2d6a27' : '#1e293b',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}
              >
                <span>{ga.name}</span>
                {ga.cities?.length > 0 && (
                  <span style={{ fontSize: '11px', color: '#94a3b8' }}>▸</span>
                )}
              </div>
            ))}
          </div>

          {/* ── Column 2: Cities under hovered GA ── */}
          {currentGA && (
            <div
              style={{ minWidth: '150px', borderRight: '1px solid #e2e8f0' }}
              onMouseEnter={cancelClose}
            >
              {(!currentGA.cities || currentGA.cities.length === 0) && (
                <div style={{ padding: '10px 14px', fontSize: '12px', color: '#94a3b8' }}>
                  No cities
                </div>
              )}

              {(currentGA.cities || []).map(city => (
                <div
                  key={city.id || city.name}
                  onMouseEnter={() => { cancelClose(); setActiveCity(city.name); }}
                  style={{
                    padding: '10px 14px', fontSize: '12px', cursor: 'pointer',
                    background: activeCity === city.name ? '#f0f7ee' : 'white',
                    color: activeCity === city.name ? '#2d6a27' : '#374151',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                  }}
                >
                  <span>{city.name}</span>
                  {city.areas?.length > 0 && (
                    <span style={{ fontSize: '11px', color: '#94a3b8' }}>▸</span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ── Column 3: Areas under hovered City ── */}
          {currentCity && (
            <div
              style={{ minWidth: '130px' }}
              onMouseEnter={cancelClose}
            >
              {(!currentCity.areas || currentCity.areas.length === 0) && (
                <div style={{ padding: '10px 14px', fontSize: '12px', color: '#94a3b8' }}>
                  No areas
                </div>
              )}

              {(currentCity.areas || []).map(area => (
                <div
                  key={area}
                  onClick={() => {
                    onSelect(activeGA, activeCity, area);
                    setActiveGA(null);
                    setActiveCity(null);
                  }}
                  style={{
                    padding: '10px 14px', fontSize: '12px', cursor: 'pointer',
                    color: '#374151'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = '#f0f7ee'}
                  onMouseLeave={e => e.currentTarget.style.background = 'white'}
                  onMouseDown={e => e.preventDefault()}
                >
                  {area}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default SiteFlyoutMenu;
