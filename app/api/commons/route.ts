import { NextRequest, NextResponse } from 'next/server'

export const revalidate = 86400

export async function GET(request: NextRequest) {
  const name = request.nextUrl.searchParams.get('name')?.trim() ?? ''
  if (name.length < 2 || name.length > 100) {
    return NextResponse.json({ error: 'A summit name is required.' }, { status: 400 })
  }

  const search = name.replace(/["\\]/g, ' ').replace(/\s+/g, ' ')
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    origin: '*',
    generator: 'search',
    gsrnamespace: '6',
    gsrsearch: `intitle:"${search}"`,
    gsrlimit: '8',
    prop: 'imageinfo',
    iiprop: 'url|extmetadata',
    iiurlwidth: '960',
  })

  try {
    const response = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`, {
      headers: {
        Accept: 'application/json',
        'Api-User-Agent': '100CimsCat/1.0 (https://100-cims-cat.vercel.app/)',
      },
      next: { revalidate },
    })

    if (!response.ok) throw new Error('Commons request failed')

    const payload = await response.json()
    return NextResponse.json(payload, {
      headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800' },
    })
  } catch {
    return NextResponse.json({ error: 'Photo search is temporarily unavailable.' }, { status: 502 })
  }
}
