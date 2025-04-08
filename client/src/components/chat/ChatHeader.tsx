import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Search, Info, Menu } from "lucide-react";
import { ChatSessionWithDetails } from "@/lib/types";

interface ChatHeaderProps {
  session: ChatSessionWithDetails | null;
  role: "customer" | "agent";
  isTyping: boolean;
  onShowSidebar?: () => void;
  onToggleInfo?: () => void;
}

export function ChatHeader({ session, role, isTyping, onShowSidebar, onToggleInfo }: ChatHeaderProps) {
  if (role === "customer") {
    return (
      <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-white">
        <div className="flex items-center space-x-3">
          <Avatar className="w-10 h-10 bg-primary text-white">
            <AvatarFallback>
              {session?.agent?.avatarInitials || "CS"}
            </AvatarFallback>
          </Avatar>
          <div>
            <h2 className="font-medium">
              {session?.agent?.displayName || "Customer Support"}
            </h2>
            <div className="flex items-center space-x-1">
              <span className={`w-2 h-2 rounded-full ${session?.agent ? "bg-online" : "bg-offline"}`}></span>
              <span className="text-xs text-textMedium">
                {session?.agent ? "Agent online" : "Waiting for agent..."}
              </span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <Button variant="ghost" size="icon" onClick={onToggleInfo}>
            <Info className="h-5 w-5 text-textMedium" />
          </Button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-white">
      <div className="flex items-center space-x-3">
        {onShowSidebar && (
          <div className="relative md:hidden">
            <Button variant="ghost" size="icon" onClick={onShowSidebar}>
              <Menu className="h-5 w-5" />
            </Button>
          </div>
        )}
        
        <Avatar className="w-10 h-10 bg-blue-100 text-primary">
          <AvatarFallback>
            {session?.customer?.avatarInitials || "?"}
          </AvatarFallback>
        </Avatar>
        <div>
          <h2 className="font-medium">
            {session?.customer?.displayName || "Select a customer"}
          </h2>
          <div className="flex items-center space-x-1">
            {isTyping ? (
              <span className="text-xs text-textMedium typing-indicator">
                Typing<span>.</span><span>.</span><span>.</span>
              </span>
            ) : (
              <span className="text-xs text-textMedium">
                {session?.customer?.status === "online" ? "Active now" : "Offline"}
              </span>
            )}
          </div>
        </div>
      </div>
      
      <div className="flex items-center space-x-2">
        <Button variant="ghost" size="icon">
          <Search className="h-5 w-5 text-textMedium" />
        </Button>
        <Button variant="ghost" size="icon" onClick={onToggleInfo}>
          <Info className="h-5 w-5 text-textMedium" />
        </Button>
      </div>
    </div>
  );
}
