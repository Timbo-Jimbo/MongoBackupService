import { LoadingSpinner } from "@comp/loading-spinner"
import { Separator } from "@comp/separator"
import { Skeleton } from "@comp/skeleton"
import { cn } from "@lib/utils"

export function SkeletonList({
    count,
    className,
}: {
    count: number,
    className?: string
}) {

    return (
        <>
            {Array.from({ length: count }).map((_, index) => (
                <>
                <Skeleton className={cn(["w-full",className])}/>
                {index < count - 1 && <Separator className="my-4"/>}
                </>
            ))}
            {count == 0 && (
            <div className="flex flex-col m-4 place-items-center justify-center">
                <LoadingSpinner className="w-10 h-10 opacity-50" />
            </div>
            )}
      </>
    )
}