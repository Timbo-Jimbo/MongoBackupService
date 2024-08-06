 import { toast } from "sonner";

 
function toastForActionResult(response?: { success: boolean; message: string }) {
    const { success, message } = response ?? { success: false, message: "An error occurred" }
  
    if(success){
        toast.success(message);
    }
    else {
        toast.error(message);
    }
  }
  
  export { toast, toastForActionResult }
  