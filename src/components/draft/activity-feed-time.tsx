"use client";

import { useEffect, useState } from "react";

interface ActivityFeedTimeProps {
  iso: string;
}

/**
 * Activity log timestamps: avoid SSR/client `toLocaleTimeString()` mismatches (locale + 12h vs 24h).
 */
export function ActivityFeedTime({ iso }: ActivityFeedTimeProps) {
  const [label, setLabel] = useState("-");

  useEffect(() => {
    queueMicrotask(() => {
      setLabel(
        new Date(iso).toLocaleTimeString(undefined, {
          hour: "numeric",
          minute: "2-digit",
          second: "2-digit",
        }),
      );
    });
  }, [iso]);

  return (
    <time dateTime={iso} className="text-[10px] tabular-nums opacity-70">
      {label}
    </time>
  );
}
