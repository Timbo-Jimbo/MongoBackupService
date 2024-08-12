import { cn } from "@lib/utils";

interface StatboxProps {
    Icon?: React.ComponentType<React.SVGProps<SVGSVGElement>>;
    title: string;
    stat: string;
    className?: string;
}
  
export const Statbox: React.FC<StatboxProps> = ({
    title,
    stat,
    Icon,
    className
}) => {
    return (
        <div className={cn(["flex flex-row shrink-0 place-items-center", className])}>
            {Icon && <Icon className="w-8 h-8 mr-3" />}
            <div className="flex flex-col gap-0">
                <span className="text-muted-foreground text-xs">{title}</span>
                {stat} 
            </div>
        </div>
    );
}

interface MiniStatboxProps {
    title: string;
    stat: string;
    className?: string;
}
  
export const MiniStatbox: React.FC<MiniStatboxProps> = ({
    title,
    stat,
    className
}) => {
    return (
        <div className={cn(["flex flex-col gap-0", className])}>
            <span className="text-muted-foreground text-xs">{title}</span>
            {stat} 
        </div>
    );
}