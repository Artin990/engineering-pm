import { ProjectNav } from "@/components/features/project-nav";

/**
 * Project section layout — هدر پروژه + ناوبری تب‌ها.
 * TODO (موج ۲+): guard دسترسی با requireProjectKeyRole از lib/auth/rbac.
 */
export default function ProjectLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div>
      <ProjectNav />
      <div className="p-[30px]">{children}</div>
    </div>
  );
}
