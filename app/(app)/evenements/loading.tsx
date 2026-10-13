import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <div>
      <Skeleton className="h-11 w-48" />
      <Skeleton className="mt-3 h-4 w-40" />
      <Skeleton className="mt-12 h-9 w-52 rounded-full" />
      <div className="mt-8 space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-2xl" />
        ))}
      </div>
    </div>
  )
}
