import { use } from "react";
import { ProjectNav } from "@/components/features/project-nav";
import { ProjectStoreProvider } from "@/lib/project-store";

export default function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ key: string }>;
}) {
  const { key } = use(params);

  return (
    <ProjectStoreProvider projectKey={key}>
      <div>
        <ProjectNav />
        <div className="p-4 sm:p-6 lg:p-8">{children}</div>
      </div>
    </ProjectStoreProvider>
  );
}
