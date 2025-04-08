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
  
  // Send typing indicator
  useEffect(() => {
    if (message.length > 0) {
      onTyping(true);
    } else {
      onTyping(false);
    }
  }, [message, onTyping]);
  
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    
    if (!message.trim() || disabled) return;
    
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
            disabled={disabled}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
          />
          <div className="absolute bottom-2 right-2 flex space-x-1">
            <Button type="button" variant="ghost" size="icon" disabled={disabled}>
              <Paperclip className="h-5 w-5 text-textMedium" />
            </Button>
            <Button type="button" variant="ghost" size="icon" disabled={disabled}>
              <Smile className="h-5 w-5 text-textMedium" />
            </Button>
          </div>
        </div>
        <Button 
          type="submit" 
          className="bg-primary text-white rounded-full w-10 h-10 flex items-center justify-center flex-shrink-0 hover:bg-blue-700 transition"
          disabled={!message.trim() || disabled}
        >
          <Send className="h-5 w-5" />
        </Button>
      </form>
    </div>
  );
}
