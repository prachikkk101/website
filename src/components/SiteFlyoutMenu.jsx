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

  console.log('sites data:', sites);

  return (
    <div 
      style={{ position: 'relative', display: 'inline-block' }}
      onMouseEnter={() => {
        console.log('GA menu hovered');
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
        color: '#374151', display: 'flex', alignItems: 'center', gap: '4px'
      }}>
        {selectedLabel || 'All GA'} ▾
      </button>

      {activeGA !== null && (
        <div style={{
          position: 'absolute', top: '100%', left: 0,
          background: 'white', border: '3px solid red',
          borderRadius: '6px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          minWidth: '200px', zIndex: 9999, marginTop: '4px',
          display: 'flex', isolation: 'isolate'
        }}
          onMouseEnter={cancelClose}
        >
          {/* Column 1: GA Locations */}
          <div style={{ minWidth: '200px', borderRight: '1px solid #e2e8f0' }}>
            <div
              onClick={() => {
                onSelect('all', 'all');
                setActiveGA(null);
              }}
              onMouseEnter={() => { cancelClose(); setActiveGA('open'); }}
              style={{
                padding: '10px 14px', fontSize: '13px',
                cursor: 'pointer',
                background: activeGA === 'open' ? '#f0f7ee' : 'white',
                color: activeGA === 'open' ? '#2d6a27' : '#1e293b',
                fontWeight: 'bold', borderBottom: '1px solid #f1f5f9'
              }}
            >
              All GA
            </div>
            {sites.map(site => (
              <div
                key={site.value}
                onMouseEnter={() => { cancelClose(); setActiveGA(site.value); }}
                style={{
                  padding: '10px 14px', fontSize: '13px',
                  cursor: 'pointer',
                  background: activeGA === site.value ? '#f0f7ee' : 'white',
                  color: activeGA === site.value ? '#2d6a27' : '#1e293b',
                  display: 'flex', justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <span>{site.label}</span>
                <span style={{ fontSize: '11px', color: '#94a3b8' }}>▸</span>
              </div>
            ))}
          </div>

          {/* Column 2: Cities/Areas for hovered GA */}
          {activeGA && activeGA !== 'open' && activeGA !== 'all' && (
            <div 
              style={{ minWidth: '180px', maxHeight: '300px', overflowY: 'auto' }}
              onMouseEnter={cancelClose}
            >
              {sites.find(s => s.value === activeGA)?.areas?.map(area => (
                <div
                  key={area}
                  onClick={() => {
                    onSelect(activeGA, area);
                    setActiveGA(null);
                  }}
                  style={{
                    padding: '10px 14px', fontSize: '12px',
                    cursor: 'pointer', color: '#374151'
                  }}
                  onMouseDown={(e) => e.preventDefault()}
                >
                  {area}
                </div>
              )) || (
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
