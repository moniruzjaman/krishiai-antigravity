import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('Supabase URL or Anon Key is missing. Supabase functionality may be limited.')
}

export const supabase = createClient(
    supabaseUrl || 'https://nmngzjrrysjzuxfcklrk.supabase.co',
    supabaseAnonKey || 'sb_publishable_xdUeR6nUkQYI9hHC3VASPg_rszNYV56'
)
