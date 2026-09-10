import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MOCK_CYCLES } from "@/components/features/__fixtures__/mock-data";
import { Badge } from "@/components/ui/badge";
import { CYCLE_STATUS_LABEL } from "@/components/features/types";
import { faDate, faNumber, faPercent } from "@/lib/format";

/**
 * نمای سایکل‌ها — اسپرینت‌ها با پیشرفت وزنی و burndown خلاصه.
 */
export default async function CyclesPage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const { key } = await params;

  return (
    <section aria-label="سایکل‌ها" className="space-y-[20px]">
      <header>
        <h1 className="text-[20px] font-semibold">سایکل‌ها — {key}</h1>
        <p className="text-[14px] text-[var(--text-muted)]">
          اسپرینت‌ها با پیشرفت وزنی (نه تعداد خام)
        </p>
      </header>

      <div className="grid grid-cols-1 gap-[16px] lg:grid-cols-2">
        {MOCK_CYCLES.map((cycle) => (
          <Card key={cycle.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{cycle.name}</CardTitle>
                <Badge
                  variant={
                    cycle.status === "active"
                      ? "default"
                      : cycle.status === "completed"
                        ? "success"
                        : "secondary"
                  }
                >
                  {CYCLE_STATUS_LABEL[cycle.status]}
                </Badge>
              </div>
              <p className="text-[14px] text-[var(--text-muted)]">
                {faDate(cycle.startDate)} تا {faDate(cycle.endDate)}
              </p>
              {cycle.goal && (
                <p className="text-[14px] text-[var(--text-secondary)]">
                  هدف: {cycle.goal}
                </p>
              )}
            </CardHeader>
            <CardContent className="space-y-[12px]">
              <div>
                <div className="mb-[5px] flex items-center justify-between text-[14px]">
                  <span>پیشرفت وزنی</span>
                  <span className="font-semibold">
                    {faPercent(cycle.progress ?? 0)}
                  </span>
                </div>
                <div className="h-[8px] w-full overflow-hidden rounded-full bg-[var(--surface-raised)]">
                  <div
                    className="h-full rounded-full bg-[var(--primary)] transition-[width_0.4s_cubic-bezier(0.165,0.84,0.44,1)]"
                    style={{ width: `${(cycle.progress ?? 0) * 100}%` }}
                    role="progressbar"
                    aria-valuenow={Math.round((cycle.progress ?? 0) * 100)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between text-[14px] text-[var(--text-muted)]">
                <span>
                  استوری‌پوینت: {faNumber(cycle.doneEstimate ?? 0)} از{" "}
                  {faNumber(cycle.totalEstimate ?? 0)}
                </span>
                <span>
                  {faNumber(cycle.totalEstimate && cycle.doneEstimate ? cycle.totalEstimate - cycle.doneEstimate : 0)}{" "}
                  باقی‌مانده
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
