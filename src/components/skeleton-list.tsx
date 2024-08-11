import { Separator } from "@comp/separator"
import { Skeleton } from "@comp/skeleton"
import { cn } from "@lib/utils"
import { Fragment } from "react"
import { toast } from "sonner"

export function SkeletonList({
    count,
    className,
    children
}: {
    count: number,
    className?: string,
    children?: React.ReactNode
}) {

    if(count <= 0)
        count = 1;

    return (
        <div key={"SkeletonList"}>
            {Array.from({ length: count }).map((_, index) => (
                <Fragment key={index}>
                {children || <Skeleton className={cn("h-10", className)}/>}
                {index < count - 1 && <Separator className="my-4"/>}
                </Fragment>
            ))}
        </div>
    )
}