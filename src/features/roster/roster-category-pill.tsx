import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface RosterCategoryPillProps {
  name: string;
  colorHex?: string | null;
  className?: string;
}

export function RosterCategoryPill({ name, colorHex, className }: RosterCategoryPillProps) {
  const tinted = typeof colorHex === "string" && /^#[0-9A-Fa-f]{6}$/u.test(colorHex);

  return (
    <Badge
      variant={tinted ? "outline" : "secondary"}
      className={cn(
        "max-w-[18rem] truncate border font-medium tracking-tight",
        tinted &&
          "border-transparent bg-muted/55 text-foreground shadow-[inset_0_0_0_1px_rgba(15,23,42,0.08)] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]",
        className,
      )}
      style={
        tinted
          ? { borderColor: `${colorHex}55`, backgroundColor: `${colorHex}22`, color: "inherit" }
          : undefined
      }
    >
      <span className="truncate">{name}</span>
    </Badge>
  );
}
