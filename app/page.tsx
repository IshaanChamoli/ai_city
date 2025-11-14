'use client';

import { LoginPage } from '@/components/auth/LoginPage';
import { createClient } from '@/lib/supabase/client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        router.push('/chat');
      }
    };

    checkUser();
  }, [router, supabase]);

  return <LoginPage />;
}
