import React from 'react';

interface SkeletonProps {
    className?: string;
    variant?: 'text' | 'circular' | 'rectangular';
    width?: string | number;
    height?: string | number;
}

const Skeleton: React.FC<SkeletonProps> = ({
    className = "",
    variant = 'text',
    width,
    height
}) => {
    const baseStyle: React.CSSProperties = {
        width: width,
        height: height,
    };

    const variantClasses = {
        text: 'rounded-md h-4 w-full',
        circular: 'rounded-full',
        rectangular: 'rounded-xl',
    };

    return (
        <div
            className={`animate-pulse bg-slate-200/60 relative overflow-hidden ${variantClasses[variant]} ${className}`}
            style={baseStyle}
        >
            <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/30 to-transparent" />
        </div>
    );
};

export default Skeleton;
