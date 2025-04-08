import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

interface AgentStatusProps {
  name: string;
  avatarInitials: string;
}

export function AgentStatus({ name, avatarInitials }: AgentStatusProps) {
  return (
    <div className="p-4 border-t border-gray-200 bg-gray-50">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Avatar className="w-8 h-8 bg-gray-200">
            <AvatarFallback>{avatarInitials}</AvatarFallback>
          </Avatar>
          <div>
            <p className="text-sm font-medium">{name}</p>
            <p className="text-xs text-textMedium">Support Agent</p>
          </div>
        </div>
        <Button variant="secondary" className="text-xs px-2 py-1 rounded">
          Settings
        </Button>
      </div>
    </div>
  );
}
