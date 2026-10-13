import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <div>
      <Skeleton className="h-11 w-64" />
      <Skeleton className="mt-3 h-4 w-96" />
      <Skeleton className="mt-12 h-16 rounded-2xl" />
      <div className="mt-14 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-52 rounded-2xl" />
        ))}
      </div>
    </div>
  )
}
