import { Sidebar } from "@/components/features/sidebar";

/**
 * Main app shell — RTL sidebar + content area.
 * TODO (موج ۲): auth guard (redirect to /login if not authenticated)
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col lg:flex-row bg-[var(--background)]">
      <Sidebar />
      <main className="flex-1 min-w-0 overflow-y-auto p-3 sm:p-5 lg:p-7">
        {children}
      </main>
    </div>
  );
}
