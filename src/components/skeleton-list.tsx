import { LoadingSpinner } from "@comp/loading-spinner"
import { Separator } from "@comp/separator"
import { Skeleton } from "@comp/skeleton"
import { cn } from "@lib/utils"
import dynamic from "next/dynamic"
import { Fragment } from "react"

export function SkeletonList({
    count,
    className,
    children
}: {
    count: number,
    className?: string,
    children?: React.ReactNode
}) {

    return (
        <div key={"SkeletonList"}>
            {Array.from({ length: count }).map((_, index) => (
                <Fragment key={index}>
                {children || <Skeleton className={cn("h-10", className)}/>}
                {index < count - 1 && <Separator className="my-4"/>}
                </Fragment>
            ))}
            {count == 0 && (
            <div className="flex flex-col m-4 place-items-center justify-center">
                <LoadingSpinner className="w-10 h-10 text-muted-foreground" />
            </div>
            )}
        </div>
    )
}