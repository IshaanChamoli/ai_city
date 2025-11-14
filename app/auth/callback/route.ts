import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');

  if (code) {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);

      if (error) {
        console.error('Error exchanging code for session:', error);
        return NextResponse.redirect(new URL('/?error=auth_failed', requestUrl.origin));
      }

      if (data.user) {
        // Sync user to public.users table
        const { error: syncError } = await supabase
          .from('users')
          .upsert({
            id: data.user.id,
            email: data.user.email!,
            name: data.user.user_metadata.full_name || data.user.email!.split('@')[0],
            profile_picture: data.user.user_metadata.avatar_url || null,
          }, {
            onConflict: 'id'
          });

        if (syncError) {
          console.error('Error syncing user to public.users:', syncError);
        }
      }

      // Redirect to chat page after successful login
      return NextResponse.redirect(new URL('/chat', requestUrl.origin));
    } catch (err) {
      console.error('Callback error:', err);
      return NextResponse.redirect(new URL('/?error=server_error', requestUrl.origin));
    }
  }

  // No code provided, redirect to home
  return NextResponse.redirect(new URL('/', requestUrl.origin));
}
