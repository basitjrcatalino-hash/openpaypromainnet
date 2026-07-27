export function OtSkeletonGrid({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="animate-pulse overflow-hidden rounded-2xl border border-border/40">
          <div className="aspect-square bg-muted/50" />
          <div className="space-y-2 p-3">
            <div className="h-3 w-2/3 rounded bg-muted/60" />
            <div className="h-2 w-1/3 rounded bg-muted/40" />
          </div>
        </div>
      ))}
    </div>
  );
}
