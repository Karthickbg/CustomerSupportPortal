import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Paperclip, Send, Smile } from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";
import { WebSocketConnectionStatus } from "@/lib/types";
import { ConnectionStatus } from "./ConnectionStatus";

interface ChatInputProps {
  onSendMessage: (content: string) => void;
  onTyping: (isTyping: boolean) => void;
  connectionStatus: WebSocketConnectionStatus;
  disabled?: boolean;
}

export function ChatInput({ 
  onSendMessage, 
  onTyping, 
  connectionStatus,
  disabled = false
}: ChatInputProps) {
  const [message, setMessage] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [localDisabled, setLocalDisabled] = useState(false);
  
  // Auto-resize textarea as user types
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
    
    if (textarea.scrollHeight > 150) {
      textarea.style.height = '150px';
      textarea.style.overflowY = 'auto';
    } else {
      textarea.style.overflowY = 'hidden';
    }
  }, [message]);
  
  // Determine if the input should be disabled
  // For customer chat, we only disable if the session is ended, not based on connection status
  useEffect(() => {
    // We don't want to disable based on connection status alone
    setLocalDisabled(disabled);
  }, [disabled]);
  
  // Send typing indicator - only when connected
  useEffect(() => {
    if (message.length > 0 && connectionStatus.connected) {
      onTyping(true);
    } else {
      onTyping(false);
    }
  }, [message, onTyping, connectionStatus.connected]);
  
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    
    if (!message.trim() || localDisabled) return;
    
    // Attempt to send message even if connection appears down
    // The send function will queue it if needed
    onSendMessage(message.trim());
    setMessage("");
    
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };
  
  return (
    <div className="p-4 border-t border-gray-200 bg-white">
      <ConnectionStatus status={connectionStatus} />
      
      <form className="flex items-end space-x-2" onSubmit={handleSubmit}>
        <div className="flex-1 relative">
          <Textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none text-sm"
            placeholder="Type your message..."
            rows={1}
            disabled={localDisabled}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
          />
          <div className="absolute bottom-2 right-2 flex space-x-1">
            <Button type="button" variant="ghost" size="icon" disabled={localDisabled}>
              <Paperclip className="h-5 w-5 text-textMedium" />
            </Button>
            <Button type="button" variant="ghost" size="icon" disabled={localDisabled}>
              <Smile className="h-5 w-5 text-textMedium" />
            </Button>
          </div>
        </div>
        <Button 
          type="submit" 
          className="bg-primary text-white rounded-full w-10 h-10 flex items-center justify-center flex-shrink-0 hover:bg-blue-700 transition"
          disabled={!message.trim() || localDisabled}
        >
          <Send className="h-5 w-5" />
        </Button>
      </form>
    </div>
  );
}
