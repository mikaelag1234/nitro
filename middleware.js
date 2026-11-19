import {NextResponse} from 'next/server';

// Password screen for the whole site. Set DASHBOARD_PASSWORD in Vercel.
// Any username works; only the password is checked.
export function middleware(req) {
  const password = process.env.DASHBOARD_PASSWORD;
  if (!password) {
    return new NextResponse('DASHBOARD_PASSWORD is not set in Vercel environment variables.', {status: 500});
  }
  const header = req.headers.get('authorization') || '';
  if (header.startsWith('Basic ')) {
    try {
      const [, pass] = atob(header.slice(6)).split(/:(.*)/s);
      if (pass === password) return NextResponse.next();
    } catch (e) { /* fall through */ }
  }
  return new NextResponse('Password required', {
    status: 401,
    headers: {'WWW-Authenticate': 'Basic realm="Purebread Nitro Dashboard"'}
  });
}

export const config = {matcher: ['/((?!_next/static|_next/image|favicon.ico).*)']};
