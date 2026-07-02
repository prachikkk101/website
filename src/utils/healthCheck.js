// src/utils/healthCheck.js
export const checkBackend = async () => {
  const apiUrl = import.meta.env.VITE_API_URL;
  if (!apiUrl) {
    console.log('healthCheck: No VITE_API_URL defined. URL hit: None (Failed)');
    return { status: 'no_url' };
  }

  // Check the real health endpoint
  const healthUrl = `${apiUrl}/health`;
  try {
    const res = await fetch(healthUrl, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      console.log(`healthCheck: Connection succeeded. URL hit: ${healthUrl}`);
      const data = await res.json();
      return { status: 'connected', message: data.message || 'Backend online' };
    }
    console.log(`healthCheck: Connection failed with status ${res.status}. URL hit: ${healthUrl}`);
    return { status: 'error', code: res.status };
  } catch (e) {
    console.log(`healthCheck: Connection failed. URL hit: ${healthUrl}`, e);
    return { status: 'offline', message: 'Backend not reachable' };
  }
};
