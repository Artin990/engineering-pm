import { Sidebar } from "@/components/features/sidebar";

/**
 * Main app shell — RTL sidebar + content area.
 * TODO (موج ۲): auth guard (redirect to /login if not authenticated)
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-[var(--background)]">
      <Sidebar />
      <main className="flex-1 min-w-0 overflow-y-auto">{children}</main>
    </div>
  );
}
