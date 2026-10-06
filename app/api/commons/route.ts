import { NextRequest, NextResponse } from 'next/server'

export const revalidate = 86400

export async function GET(request: NextRequest) {
  const name = request.nextUrl.searchParams.get('name')?.trim() ?? ''
  if (name.length < 2 || name.length > 100) {
    return NextResponse.json({ error: 'A summit name is required.' }, { status: 400 })
  }

  const search = name.replace(/["\\]/g, ' ').replace(/\s+/g, ' ')
  try {
    const searches = [`intitle:"${search}"`, search]
    const results = await Promise.all(searches.map(async query => {
      const params = new URLSearchParams({
        action: 'query',
        format: 'json',
        origin: '*',
        generator: 'search',
        gsrnamespace: '6',
        gsrsearch: query,
        gsrlimit: '20',
        prop: 'imageinfo',
        iiprop: 'url|extmetadata',
        iiurlwidth: '960',
      })
      const response = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`, {
        headers: {
          Accept: 'application/json',
          'Api-User-Agent': '100CimsCat/1.0 (https://100-cims-cat.vercel.app/)',
        },
        next: { revalidate },
      })
      if (!response.ok) throw new Error('Commons request failed')
      return response.json()
    }))
    const pages = Object.assign({}, ...results.map(result => result.query?.pages ?? {}))
    return NextResponse.json({ query: { pages } }, {
      headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800' },
    })
  } catch {
    return NextResponse.json({ error: 'Photo search is temporarily unavailable.' }, { status: 502 })
  }
}
