export function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-3xl font-semibold tracking-normal text-foreground">{title}</h1>
    </div>
  );
}
