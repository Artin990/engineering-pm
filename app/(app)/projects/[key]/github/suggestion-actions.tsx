"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export default function SuggestionActions({ linkId }: { linkId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function act(action: "accept" | "reject") {
    setError(null);
    const res = await fetch(`/api/github/suggestions/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ linkId }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "خطا در انجام عملیات");
      return;
    }
    startTransition(() => router.refresh());
  }

  return (
    <div className="flex items-center gap-2">
      {error && <span className="text-xs text-destructive">{error}</span>}
      <button
        type="button"
        disabled={isPending}
        onClick={() => act("accept")}
        className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        تأیید
      </button>
      <button
        type="button"
        disabled={isPending}
        onClick={() => act("reject")}
        className="rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50"
      >
        رد
      </button>
    </div>
  );
}
