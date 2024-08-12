
import { toast } from "@comp/toasts";
import { useEffect, useRef } from "react";

    
//hack: seems like when we trigger an action that causes this component to unmount, 
// the 'onsettled' callback doesnt happen and the toast is not cleaned up
//...sometimes...?
export function useLoadingToastCleaner() {
  const toastRef = useRef<string | number | undefined>(0);
  
  useEffect(() => {
    return () => {
      if(toastRef.current)
        toast.dismiss(toastRef.current);
    }
  }, []);

  return toastRef;
}