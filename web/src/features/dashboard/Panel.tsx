import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

type Props = {
  title: string;
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  /** Controls rendered next to the title, e.g. a period selector. */
  actions?: ReactNode;
  className?: string;
  children: ReactNode;
};

/** Shared frame of every dashboard panel: title, skeleton while loading, error with retry. */
export function Panel({ title, isLoading, isError, onRetry, actions, className, children }: Props) {
  const headingId = `panel-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <Card className={className}>
      <section aria-labelledby={headingId}>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <CardTitle>
            <h2 id={headingId} className="text-base font-semibold">
              {title}
            </h2>
          </CardTitle>
          {actions}
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div role="status" aria-label={`Carregando ${title}`} className="space-y-3">
              <Skeleton className="h-8 w-1/2" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : isError ? (
            <div role="alert" className="flex flex-wrap items-center gap-3">
              <p className="text-sm text-destructive">Não foi possível carregar este painel.</p>
              {onRetry && (
                <Button variant="outline" size="sm" onClick={onRetry}>
                  Tentar novamente
                </Button>
              )}
            </div>
          ) : (
            children
          )}
        </CardContent>
      </section>
    </Card>
  );
}
