import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";

interface AgentHeaderProps {
  agentName: string;
  avatarInitials: string;
  isOnline: boolean;
}

export function AgentHeader({ agentName, avatarInitials, isOnline }: AgentHeaderProps) {
  const { logout } = useAuth();
  const [, navigate] = useLocation();
  
  const handleLogout = () => {
    logout();
    navigate("/auth");
  };
  
  return (
    <div className="p-4 border-b border-gray-200 flex items-center justify-between">
      <div className="flex items-center space-x-2">
        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white">
          <span className="text-sm">🎧</span>
        </div>
        <h1 className="text-lg font-semibold">Support Portal</h1>
      </div>
      <div className="flex items-center space-x-3">
        <div className="flex items-center space-x-1">
          <span className={`w-2 h-2 rounded-full ${isOnline ? "bg-green-500" : "bg-red-500"}`}></span>
          <span className="text-xs text-muted-foreground">{isOnline ? "Online" : "Offline"}</span>
        </div>
        <Button variant="ghost" size="icon" onClick={handleLogout} title="Logout">
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
