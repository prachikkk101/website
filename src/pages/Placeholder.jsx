// src/pages/Placeholder.jsx
// Placeholder for pages not yet implemented

export default function Placeholder({ title, icon }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div
        className="w-20 h-20 rounded-2xl flex items-center justify-center mb-6"
        style={{ background: '#e8f5e4' }}
      >
        <span className="text-4xl">{icon || '🔧'}</span>
      </div>
      <h2 className="text-2xl font-bold text-gray-700 mb-2">{title}</h2>
      <p className="text-gray-400 text-sm max-w-xs">
        This module is under development. Come back soon for the full feature set.
      </p>
      <div
        className="mt-6 px-6 py-2.5 rounded-xl text-sm font-semibold"
        style={{ background: '#2d6a27', color: 'white' }}
      >
        Coming Soon
      </div>
    </div>
  );
}
