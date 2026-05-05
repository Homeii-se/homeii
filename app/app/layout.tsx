import { createClient } from '@/lib/supabase/server';
import { Sidebar } from './sidebar';
import { LogoutButton } from './hem/logout-button';

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <Sidebar userEmail={user?.email} />

      <div className="flex-1">
        <div className="flex justify-end px-6 py-3 border-b border-gray-200 bg-white">
          <LogoutButton />
        </div>
        {children}
      </div>
    </div>
  );
}