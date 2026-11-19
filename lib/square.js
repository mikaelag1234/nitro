// Calls Square's Reporting API from the server. The access token never reaches the browser.

const LOAD_URL = 'https://connect.squareup.com/reporting/v1/load';

export async function load(query) {
  const token = process.env.SQUARE_ACCESS_TOKEN;
  if (!token) throw new Error('SQUARE_ACCESS_TOKEN is not set in Vercel environment variables.');

  for (let attempt = 0; attempt < 15; attempt++) {
    const res = await fetch(LOAD_URL, {
      method: 'POST',
      headers: {Authorization: `Bearer ${token}`, 'Content-Type': 'application/json'},
      body: JSON.stringify({query}),
      cache: 'no-store'
    });
    const body = await res.json().catch(() => ({}));
    // Square answers "Continue wait" while a query is still being computed
    if (body && body.error === 'Continue wait') {
      await new Promise((r) => setTimeout(r, 1500));
      continue;
    }
    if (!res.ok || (body && body.error)) {
      const msg = typeof body.error === 'string' ? body.error : JSON.stringify(body.error || body.errors || body);
      throw new Error(`Square ${res.status}: ${msg}`);
    }
    return body.data || [];
  }
  throw new Error('Square took too long to answer. Try again in a minute.');
}
