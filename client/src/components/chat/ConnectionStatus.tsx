import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { WebSocketConnectionStatus } from "@/lib/types";
import { AlertCircle, Wifi, WifiOff } from "lucide-react";

interface ConnectionStatusProps {
  status: WebSocketConnectionStatus;
}

export function ConnectionStatus({ status }: ConnectionStatusProps) {
  if (status.connected) {
    return null;
  }

  return (
    <Alert variant="destructive" className="mb-3 px-3 py-2 bg-red-50 text-error rounded-md text-sm">
      <div className="flex items-center space-x-1">
        {status.reconnecting ? (
          <>
            <WifiOff className="h-4 w-4" />
            <AlertTitle>Connection lost</AlertTitle>
          </>
        ) : (
          <>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Connection error</AlertTitle>
          </>
        )}
        <AlertDescription>
          {status.reconnecting ? "Reconnecting..." : "Failed to connect"}
        </AlertDescription>
      </div>
    </Alert>
  );
}
