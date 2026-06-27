// src/pages/Placeholder.jsx
export default function Placeholder({ title, icon }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'80px 24px', textAlign:'center' }}>
      <div style={{ width:72, height:72, borderRadius:16, background:'#e8f5e4', display:'flex', alignItems:'center', justifyContent:'center', fontSize:34, marginBottom:20 }}>
        {icon ?? '🔧'}
      </div>
      <h2 style={{ fontSize:22, fontWeight:700, color:'#374151', margin:'0 0 8px' }}>{title}</h2>
      <p style={{ fontSize:13, color:'#94a3b8', maxWidth:280, margin:'0 0 24px' }}>
        This module is currently under development. Full features coming soon.
      </p>
      <span style={{ padding:'8px 20px', background:'#2d6a27', color:'#fff', borderRadius:8, fontSize:13, fontWeight:600 }}>
        Coming Soon
      </span>
    </div>
  );
}
