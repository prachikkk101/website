// src/components/SiteFlyoutMenu.jsx
import { useState, useRef } from 'react';

function SiteFlyoutMenu({ sites, onSelect, selectedLabel }) {
  const [activeGA, setActiveGA] = useState(null);
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
    }, 200);
  };

  return (
    <div 
      style={{ position: 'relative', display: 'inline-block' }}
      onMouseEnter={() => {
        cancelClose();
        if (activeGA === null) {
          setActiveGA('open');
        }
      }}
      onMouseLeave={scheduleClose}
    >
      <button style={{
        height: '32px', padding: '0 12px',
        background: 'white', border: '1px solid #d1d5db',
        borderRadius: '4px', fontSize: '12px', cursor: 'pointer',
        color: '#374151', display: 'flex', alignItems: 'center', gap: '4px',
        maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden'
      }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {selectedLabel || 'All GA'}
        </span>
        {' '}▾
      </button>

      {activeGA !== null && (
        <div style={{
          position: 'absolute', top: '100%', left: 0,
          background: 'white', border: '1px solid #e2e8f0',
          borderRadius: '6px', boxShadow: '0 6px 20px rgba(0,0,0,0.18)',
          minWidth: '200px', zIndex: 9999, marginTop: '4px',
          display: 'flex'
        }}
          onMouseEnter={cancelClose}
        >
          {/* Column 1: GA Locations */}
          <div style={{ minWidth: '200px', borderRight: '1px solid #e2e8f0' }}>
            {/* All GA (reset) */}
            <div
              onClick={() => { onSelect('all', 'all'); setActiveGA(null); }}
              onMouseEnter={() => { cancelClose(); setActiveGA('open'); }}
              style={{
                padding: '10px 14px', fontSize: '13px', cursor: 'pointer',
                background: activeGA === 'open' ? '#f0f7ee' : 'white',
                color: '#1f4e1a', fontWeight: 'bold',
                borderBottom: '1px solid #f1f5f9'
              }}
            >
              All GA
            </div>

            {sites.length === 0 && (
              <div style={{ padding: '10px 14px', fontSize: '12px', color: '#94a3b8' }}>
                No GA locations added yet
              </div>
            )}

            {sites.map(site => (
              <div
                key={site.value}
                onMouseEnter={() => { cancelClose(); setActiveGA(site.value); }}
                style={{
                  padding: '10px 14px', fontSize: '13px', cursor: 'pointer',
                  background: activeGA === site.value ? '#f0f7ee' : 'white',
                  color: activeGA === site.value ? '#2d6a27' : '#1e293b',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}
              >
                <span>{site.label}</span>
                {site.areas && site.areas.length > 0 && (
                  <span style={{ fontSize: '11px', color: '#94a3b8' }}>▸</span>
                )}
              </div>
            ))}
          </div>

          {/* Column 2: Areas for hovered GA */}
          {activeGA && activeGA !== 'open' && activeGA !== 'all' && (
            <div 
              style={{ minWidth: '180px', maxHeight: '300px', overflowY: 'auto' }}
              onMouseEnter={cancelClose}
            >
              {/* All Areas (select entire GA) */}
              <div
                onClick={() => { onSelect(activeGA, 'all'); setActiveGA(null); }}
                style={{
                  padding: '10px 14px', fontSize: '12px', cursor: 'pointer',
                  color: '#1f4e1a', fontWeight: 'bold',
                  borderBottom: '1px solid #f1f5f9'
                }}
                onMouseDown={(e) => e.preventDefault()}
              >
                All Areas
              </div>

              {(sites.find(s => s.value === activeGA)?.areas || []).map(area => (
                <div
                  key={area}
                  onClick={() => { onSelect(activeGA, area); setActiveGA(null); }}
                  style={{
                    padding: '10px 14px', fontSize: '12px',
                    cursor: 'pointer', color: '#374151'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = '#f0f7ee'}
                  onMouseLeave={e => e.currentTarget.style.background = 'white'}
                  onMouseDown={(e) => e.preventDefault()}
                >
                  {area}
                </div>
              ))}

              {(sites.find(s => s.value === activeGA)?.areas || []).length === 0 && (
                <div style={{ padding: '10px 14px', fontSize: '12px', color: '#94a3b8' }}>
                  No areas listed
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default SiteFlyoutMenu;
