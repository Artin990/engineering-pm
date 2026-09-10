import { faPercent } from "@/lib/format";

interface ProgressRingProps {
  /** 0..1 */
  value: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
}

/**
 * SVG donut progress ring with fa-IR percentage centered.
 * Static markup — no client JS needed.
 */
export function ProgressRing({
  value,
  size = 80,
  strokeWidth = 8,
  label,
}: ProgressRingProps) {
  const clamped = Math.max(0, Math.min(1, value));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped);
  const center = size / 2;

  return (
    <div className="flex flex-col items-center gap-[4px]">
      <div
        className="relative inline-flex items-center justify-center"
        style={{ width: size, height: size }}
      >
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          role="img"
          aria-label={`پیشرفت ${faPercent(clamped)}`}
          style={{ transform: "rotate(-90deg)" }}
        >
          {/* Track */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="var(--surface-raised, #e5e7eb)"
            strokeWidth={strokeWidth}
          />
          {/* Progress */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="var(--primary, #2563eb)"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 0.6s ease-in-out" }}
          />
        </svg>
        <span
          className="absolute inset-0 flex items-center justify-center font-semibold text-[var(--text-primary)]"
          style={{ fontSize: Math.max(12, size / 5) }}
        >
          {faPercent(clamped)}
        </span>
      </div>
      {label ? (
        <span className="text-[12px] text-[var(--text-muted)]">{label}</span>
      ) : null}
    </div>
  );
}
