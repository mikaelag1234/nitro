import {getDashboard} from '../../../lib/dashboard';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET() {
  try {
    const data = await getDashboard();
    return Response.json(data, {headers: {'Cache-Control': 'no-store'}});
  } catch (e) {
    return Response.json({error: String(e.message || e)}, {status: 502});
  }
}
