// src/utils/healthCheck.js
export const checkBackend = async () => {
  const apiUrl = import.meta.env.VITE_API_URL;
  if (!apiUrl) return { status: 'no_url' };

  try {
    const res = await fetch(`${apiUrl}/api/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const data = await res.json();
      return { status: 'connected', message: data.message || 'Backend online' };
    }
    return { status: 'error', code: res.status };
  } catch (e) {
    return { status: 'offline', message: 'Backend not reachable' };
  }
};
