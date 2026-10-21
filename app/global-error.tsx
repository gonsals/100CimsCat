'use client'
import { contactEmail } from '@/lib/project-pages'
export default function GlobalError() {
  return <html lang="ca"><body style={{ margin: 0, background: '#f5f4ef', color: '#263d30', font: '16px/1.7 system-ui,sans-serif' }}><main style={{ maxWidth: 640, margin: '10vh auto', padding: 24 }}><p>100CimsCat</p><h1>No hem pogut carregar la pàgina</h1><p>Torna-ho a provar. Si el problema continua, pots contactar amb el projecte.</p><button onClick={() => window.location.reload()} style={{ padding: '12px 18px', font: 'inherit' }}>Tornar-ho a provar</button><p><a href="/">Inici</a> · <a href={`mailto:${contactEmail}`}>Contacte</a></p></main></body></html>
}
