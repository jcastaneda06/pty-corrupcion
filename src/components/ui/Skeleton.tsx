interface Props {
  className?: string;
  count?: number;
}

export function Skeleton({ className = '', count = 1 }: Props) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={`animate-pulse bg-dark-700 rounded ${className}`}
        />
      ))}
    </>
  );
}

export function FindingCardSkeleton() {
  return (
    <div className="bg-dark-800 border border-dark-600 rounded-xl p-5 space-y-3 animate-pulse">
      <div className="flex items-start justify-between gap-3">
        <div className="h-5 bg-dark-700 rounded w-3/4" />
        <div className="h-5 bg-dark-700 rounded w-16" />
      </div>
      <div className="space-y-2">
        <div className="h-3 bg-dark-700 rounded w-full" />
        <div className="h-3 bg-dark-700 rounded w-5/6" />
        <div className="h-3 bg-dark-700 rounded w-4/6" />
      </div>
      <div className="flex gap-2 pt-1">
        <div className="h-5 bg-dark-700 rounded w-24" />
        <div className="h-5 bg-dark-700 rounded w-20" />
      </div>
    </div>
  );
}
