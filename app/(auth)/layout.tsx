/**
 * Auth layout — minimal centered layout for login/register/callback.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--background)]">
      {children}
    </div>
  );
}
