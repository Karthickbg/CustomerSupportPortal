import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { WebSocketConnectionStatus } from "@/lib/types";
import { AlertCircle, WifiOff, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

interface ConnectionStatusProps {
  status: WebSocketConnectionStatus;
}

export function ConnectionStatus({ status }: ConnectionStatusProps) {
  // Only show connection error after a delay to avoid flashing during normal connection establishment
  const [showError, setShowError] = useState(false);
  
  useEffect(() => {
    // For the customer interface, we don't want to block input even during connection issues
    // Only show error if explicitly not connected and not in reconnecting state
    if (status.connected || status.reconnecting) {
      setShowError(false);
      return;
    }
    
    // If we're completely disconnected with an error, show it after a delay
    // This prevents flashing during normal connection process
    const timer = setTimeout(() => {
      if (!status.connected && !status.reconnecting) {
        setShowError(true);
      }
    }, 5000); // 5 second delay - give more time to connect
    
    return () => clearTimeout(timer);
  }, [status.connected, status.reconnecting]);
  
  // Don't show anything if connected or if we're still in the grace period
  if (status.connected || !showError) {
    return null;
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
