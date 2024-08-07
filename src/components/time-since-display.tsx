import humanizeDuration from "humanize-duration";
import { useEffect, useState } from "react";

const DurationDisplay = ({ startTime, endTime }:{ startTime: Date | (() => Date), endTime: Date | (() => Date) }) => {

    const getHumanizedString = () => {
      const resolvedStartTime = typeof startTime === 'function' ? startTime() : startTime;
      const resolvedEndTime = typeof endTime === 'function' ? endTime() : endTime;
      return humanizeDuration(resolvedStartTime.getTime() - resolvedEndTime.getTime(), { round: true })
    }

    const [currentValue, setValue] = useState(getHumanizedString());

    useEffect(() => {
        let animationId: number;
    
        const animate = () => {

          const newValue = getHumanizedString();
          if(newValue !== currentValue)
          {
            setValue(newValue);
          }

          animationId = requestAnimationFrame(animate);
        };
    
        animationId = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(animationId);
      }, [startTime, endTime]);

    return (
        <>
            {currentValue}
        </>
    );
};

export { DurationDisplay };
