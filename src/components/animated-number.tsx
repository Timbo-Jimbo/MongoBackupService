import { useEffect, useRef, useState } from "react";

const lerp = (start: number, end: number, t: number) => {
    return start * (1 - t) + end * t;
};

const AnimatedNumber = ({ endValue, lerpFactor = 0.1 }:{ endValue: number, duration?: number, lerpFactor?: number }) => {
    const [displayValue, setDisplayValue] = useState(0);
    const currentValueRef = useRef(0);

    useEffect(() => {
        let animationId: number;
    
        const animate = () => {
          const lerpedValue = lerp(currentValueRef.current, endValue, lerpFactor);
          const difference = lerpedValue - currentValueRef.current;
          
          // Ensure we move at least 1 towards the target, but don't overshoot
          const newValue = Math.abs(difference) < 1 
            ? currentValueRef.current + Math.sign(difference)
            : lerpedValue;
    
          currentValueRef.current = Math.min(Math.max(Math.round(newValue), 0), endValue);
          setDisplayValue(currentValueRef.current);
    
          if (currentValueRef.current !== endValue) {
            animationId = requestAnimationFrame(animate);
          }
        };
    
        animationId = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(animationId);
      }, [endValue, lerpFactor]);

    return (
        <>
            {displayValue.toLocaleString()}
        </>
    );
};

export { AnimatedNumber };
