import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { badgeClasses } from "@/features/colors/palette";

type CategoryBadgeProps = { name: string; color: string | undefined; className?: string };

/** Light-tone (200) colored badge: the text color comes from the palette map, so it reads on both themes. */
export function CategoryBadge({ name, color, className }: CategoryBadgeProps) {
  const { bg, text } = badgeClasses(color);
  return (
    <Badge
      variant="outline"
      title={name}
      className={cn(
        "max-w-full border-transparent inline-block truncate ring-1 ring-inset ring-black/10 dark:ring-white/25",
        bg,
        text,
        className,
      )}
    >
      {name}
    </Badge>
  );
}
