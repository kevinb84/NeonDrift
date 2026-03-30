
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';

interface ProgressBarProps {
    value: number; // 0 to 100
    max?: number;
    label?: string;
    showValue?: boolean;
    className?: string;
    height?: string;
    color?: string;
}

export const ProgressBar = ({
    value,
    max = 100,
    label,
    showValue = false,
    className,
    height = "h-2",
    color = "bg-primary"
}: ProgressBarProps) => {
    const percentage = Math.min(Math.max((value / max) * 100, 0), 100);

    return (
        <div className={cn("w-full space-y-1", className)}>
            {(label || showValue) && (
                <div className="flex justify-between text-xs text-muted-foreground">
                    {label && <span>{label}</span>}
                    {showValue && <span>{Math.round(percentage)}%</span>}
                </div>
            )}
            <div className={cn("overflow-hidden rounded-full bg-slate-800", height)}>
                <motion.div
                    className={cn("h-full rounded-full transition-all", color)}
                    initial={{ width: 0 }}
                    animate={{ width: `${percentage}%` }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                    style={{
                        boxShadow: `0 0 10px ${color === 'bg-primary' ? '#3B82F6' : 'currentColor'}`,
                    }}
                />
            </div>
        </div>
    );
};
