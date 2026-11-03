import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function signInDestination(request: NextRequest) {
  const home = new URL('/', request.url)
  const next = request.nextUrl.searchParams.get('next')
  // URL parsing treats backslashes and some control characters as separators.
  if (next?.startsWith('/') && !next.startsWith('//') && !/[\\\u0000-\u001f\u007f]/.test(next)) {
    const destination = new URL(next, home)
    if (destination.origin === home.origin) return destination
  }
  return home
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) return NextResponse.redirect(signInDestination(request))
  }

  return NextResponse.redirect(new URL('/?auth=error', request.url))
}

