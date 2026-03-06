/**
 * Skeleton loader components — shimmer placeholders while data loads
 */

export function SkeletonLine({ className = '' }: { className?: string }) {
  return <div className={`skeleton h-4 ${className}`} />;
}

export function SkeletonCard() {
  return (
    <div className="bg-[#14171D] rounded-2xl border border-white/[0.04] p-5 space-y-3">
      <div className="skeleton h-10 w-10 rounded-xl" />
      <div className="skeleton h-7 w-20" />
      <div className="skeleton h-4 w-28" />
    </div>
  );
}

export function SkeletonChart() {
  return (
    <div className="bg-[#14171D] rounded-2xl border border-white/[0.04] p-6 space-y-4">
      <div className="skeleton h-5 w-40" />
      <div className="skeleton h-3 w-56" />
      <div className="flex items-end gap-2 h-[240px] pt-6">
        {[60, 80, 45, 90, 70, 55, 85].map((h, i) => (
          <div key={i} className="skeleton flex-1" style={{ height: `${h}%` }} />
        ))}
      </div>
    </div>
  );
}

export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="bg-[#14171D] rounded-2xl border border-white/[0.04] overflow-hidden">
      <div className="p-4 border-b border-white/[0.06]">
        <div className="skeleton h-4 w-32" />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-6 py-4 border-b border-white/[0.06] last:border-b-0">
          <div className="skeleton h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <div className="skeleton h-4 w-40" />
            <div className="skeleton h-3 w-24" />
          </div>
          <div className="skeleton h-6 w-20 rounded-full" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="skeleton h-9 w-48" />
          <div className="skeleton h-4 w-32" />
        </div>
        <div className="skeleton h-10 w-32 rounded-xl" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
      <div className="grid lg:grid-cols-2 gap-6">
        <SkeletonChart />
        <SkeletonChart />
      </div>
    </div>
  );
}
