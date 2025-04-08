import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface AgentHeaderProps {
  agentName: string;
  avatarInitials: string;
  isOnline: boolean;
}

export function AgentHeader({ agentName, avatarInitials, isOnline }: AgentHeaderProps) {
  return (
    <div className="p-4 border-b border-gray-200 flex items-center justify-between">
      <div className="flex items-center space-x-2">
        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white">
          <span className="text-sm">🎧</span>
        </div>
        <h1 className="text-lg font-semibold">Support Portal</h1>
      </div>
      <div className="flex items-center space-x-1">
        <span className={`w-2 h-2 rounded-full ${isOnline ? "bg-online" : "bg-offline"}`}></span>
        <span className="text-xs text-textMedium">{isOnline ? "Online" : "Offline"}</span>
      </div>
    </div>
  );
}
