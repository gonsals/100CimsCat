import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js'

const bucketName = 'summit-photos'

async function listUserFiles(admin: SupabaseClient<any, any, any>, userId: string) {
  const bucket = admin.storage.from(bucketName)
  const directories = [userId]
  const files: string[] = []

  while (directories.length > 0) {
    const directory = directories.pop()!
    let offset = 0

    while (true) {
      const { data, error } = await bucket.list(directory, {
        limit: 100,
        offset,
        sortBy: { column: 'name', order: 'asc' },
      })

      if (error) throw error

      for (const entry of data ?? []) {
        const path = `${directory}/${entry.name}`
        if (entry.id === null && entry.metadata === null) directories.push(path)
        else files.push(path)
      }

      if ((data?.length ?? 0) < 100) break
      offset += 100
    }
  }

  return files
}

export async function DELETE(request: NextRequest) {
  const requestOrigin = request.headers.get('origin')
  if (!requestOrigin || requestOrigin !== request.nextUrl.origin) {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 })
  }

  const userClient = await createClient()
  const { data: { user }, error: userError } = await userClient.auth.getUser()
  if (userError || !user) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: 'Account deletion is not configured.' }, { status: 503 })
  }

  const admin = createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  })

  try {
    const files = await listUserFiles(admin, user.id)
    const bucket = admin.storage.from(bucketName)
    for (let index = 0; index < files.length; index += 1000) {
      const { error } = await bucket.remove(files.slice(index, index + 1000))
      if (error) throw error
    }
  } catch {
    return NextResponse.json({ error: 'Could not remove all private photos. Please retry.' }, { status: 502 })
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id)
  if (deleteError) {
    return NextResponse.json({ error: 'Could not delete this account. Please retry.' }, { status: 502 })
  }

  return NextResponse.json({ success: true }, { headers: { 'Cache-Control': 'no-store' } })
}
