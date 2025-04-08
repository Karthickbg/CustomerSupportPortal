import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn, formatTime } from "@/lib/utils";
import { ChatMessageWithUser } from "@/lib/types";

interface ChatMessageProps {
  message: ChatMessageWithUser;
  isCurrentUser: boolean;
}

export function ChatMessage({ message, isCurrentUser }: ChatMessageProps) {
  const timestamp = message.timestamp ? formatTime(message.timestamp) : "";
  const initials = message.user?.avatarInitials || message.user?.displayName?.slice(0, 2) || "?";
  
  return (
    <div className={cn("flex mb-4", isCurrentUser ? "justify-end" : "")}>
      {!isCurrentUser && (
        <div className="flex-shrink-0 mr-3">
          <Avatar className="w-8 h-8 bg-primary text-white">
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
        </div>
      )}
      
      <div className="max-w-[75%]">
        <div className={cn(
          "rounded-lg p-3 mb-1",
          isCurrentUser ? "bg-customer" : "bg-agent"
        )}>
          <p className="text-sm">{message.content}</p>
        </div>
        
        <div className={cn(isCurrentUser ? "flex justify-end" : "")}>
          <p className={cn(
            "text-xs text-textMedium",
            isCurrentUser ? "mr-1" : "ml-1"
          )}>
            {timestamp}
          </p>
        </div>
      </div>
    </div>
  );
}

export function SystemMessage({ content, timestamp }: { content: string; timestamp?: string }) {
  return (
    <div className="flex justify-center mb-6">
      <div className="bg-gray-100 rounded-full px-4 py-1.5">
        <p className="text-xs text-textMedium">
          {content} {timestamp ? `• ${timestamp}` : ""}
        </p>
      </div>
    </div>
  );
}
