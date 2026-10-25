import { useEffect, useState } from 'react';
import { Route, Routes, Link } from 'react-router-dom';
import { healthResponseSchema } from '@specsentry/shared';

function Home() {
  const [status, setStatus] = useState('Checking service…');
  useEffect(() => {
    const controller = new AbortController();
    async function checkHealth() {
      try {
        const response = await fetch('/api/health', { signal: controller.signal });
        if (!response.ok) throw new Error('Unavailable');
        healthResponseSchema.parse(await response.json());
        if (!controller.signal.aborted) setStatus('Service is online.');
      } catch {
        if (!controller.signal.aborted) setStatus('Service is unavailable. Please try again later.');
      }
    }
    void checkHealth();
    return () => controller.abort();
  }, []);

  return <>
    <p className="eyebrow">Specification and review workspace</p>
    <h1>SpecSentry</h1>
    <p>A shared foundation for proposals, reviews, and release evidence.</p>
    <p role="status">{status}</p>
    <p className="notice">Initial setup is complete. Sign-in and role workflows will be added in subsequent development stages.</p>
  </>;
}

export function App() {
  return <main id="main-content">
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="*" element={<><h1>Page not found</h1><Link to="/">Return to SpecSentry</Link></>} />
    </Routes>
  </main>;
}
