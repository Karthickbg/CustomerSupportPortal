import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { WebSocketConnectionStatus } from "@/lib/types";
import { AlertCircle, WifiOff, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

interface ConnectionStatusProps {
  status: WebSocketConnectionStatus;
}

export function ConnectionStatus({ status }: ConnectionStatusProps) {
  // Only show connection status alerts after a delay to avoid flashing during normal connection establishment
  const [showAlert, setShowAlert] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  
  useEffect(() => {
    // Show a success message briefly when we connect
    if (status.connected) {
      setShowSuccess(true);
      // Auto-hide success message after 3 seconds
      const successTimer = setTimeout(() => {
        setShowSuccess(false);
      }, 3000);
      
      return () => clearTimeout(successTimer);
    }
    
    // Show an error message if we're disconnected for too long
    if (!status.connected && !status.reconnecting) {
      // Only show error after a delay to avoid flashing during normal reconnection
      const errorTimer = setTimeout(() => {
        if (!status.connected && !status.reconnecting) {
          setShowAlert(true);
        }
      }, 5000); // 5 second delay before showing connection error
      
      return () => clearTimeout(errorTimer);
    }
    
    // Show reconnecting status if we're actively trying to reconnect
    if (status.reconnecting) {
      setShowAlert(true);
      return;
    }
    
    // Otherwise hide all alerts
    setShowAlert(false);
  }, [status.connected, status.reconnecting]);
  
  // Don't show anything if we're not in an alert state
  if (!showAlert && !showSuccess) {
    return null;
  }
  
  // Show connection success briefly
  if (showSuccess && status.connected) {
    return (
      <Alert className="mb-3 px-3 py-2 rounded-md text-sm bg-green-50 text-green-800 border-green-200">
        <div className="flex items-center space-x-2">
          <div className="h-2 w-2 rounded-full bg-green-500"></div>
          <AlertTitle className="text-sm font-medium">Connected to support</AlertTitle>
        </div>
      </Alert>
    );
  }

  // Show a more user-friendly message for customers
  return (
    <Alert 
      variant="destructive" 
      className={cn(
        "mb-3 px-3 py-2 rounded-md text-sm",
        status.reconnecting 
          ? "bg-amber-50 text-amber-800 border-amber-200" 
          : "bg-red-50 text-red-800 border-red-200"
      )}
    >
      <div className="flex items-center space-x-2">
        {status.reconnecting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin text-amber-600" />
            <AlertTitle>Connecting to support...</AlertTitle>
            <AlertDescription>
              Please wait while we establish your connection
            </AlertDescription>
          </>
        ) : (
          <>
            <AlertCircle className="h-4 w-4 text-red-600" />
            <AlertTitle>Connection issue</AlertTitle>
            <AlertDescription>
              There was a problem connecting to our chat system. The page will automatically reconnect.
            </AlertDescription>
          </>
        )}
      </div>
    </Alert>
  );
}
