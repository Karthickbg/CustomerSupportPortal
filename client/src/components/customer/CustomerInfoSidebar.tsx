import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ChatSessionWithDetails } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import { Phone, Mail, ShoppingBag } from "lucide-react";

interface CustomerInfoSidebarProps {
  session: ChatSessionWithDetails;
  className?: string;
}

export function CustomerInfoSidebar({ session, className }: CustomerInfoSidebarProps) {
  const customer = session.customer;
  if (!customer) return null;
  
  const customerSince = customer.createdAt 
    ? formatDate(customer.createdAt)
    : "Recent customer";
  
  const initials = customer.avatarInitials || customer.displayName?.slice(0, 2) || "?";
  
  return (
    <div className={`bg-white border-l border-gray-200 ${className}`}>
      <div className="p-4 border-b border-gray-200">
        <h2 className="font-semibold">Customer Information</h2>
      </div>
      
      <div className="p-4">
        <div className="flex flex-col items-center mb-6">
          <Avatar className="w-16 h-16 bg-blue-100 text-primary mb-2">
            <AvatarFallback className="text-xl">{initials}</AvatarFallback>
          </Avatar>
          <h3 className="font-medium">{customer.displayName}</h3>
          <p className="text-sm text-textMedium">Customer since {customerSince}</p>
        </div>
        
        <div className="space-y-4">
          <div>
            <h4 className="text-xs uppercase text-textMedium font-medium mb-1">Contact</h4>
            <div className="space-y-2">
              <div className="flex items-start space-x-2">
                <Mail className="text-textMedium h-4 w-4 mt-0.5" />
                <span className="text-sm">{customer.email}</span>
              </div>
              {customer.phone && (
                <div className="flex items-start space-x-2">
                  <Phone className="text-textMedium h-4 w-4 mt-0.5" />
                  <span className="text-sm">{customer.phone}</span>
                </div>
              )}
            </div>
          </div>
          
          <div>
            <h4 className="text-xs uppercase text-textMedium font-medium mb-1">Recent Orders</h4>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <ShoppingBag className="text-textMedium h-4 w-4" />
                  <span className="text-sm">Order #12345</span>
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800">Shipped</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <ShoppingBag className="text-textMedium h-4 w-4" />
                  <span className="text-sm">Order #11876</span>
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-800">Delivered</span>
              </div>
            </div>
          </div>
          
          <div>
            <h4 className="text-xs uppercase text-textMedium font-medium mb-1">Chat History</h4>
            <div className="space-y-2">
              <div className="text-sm">
                <div className="flex justify-between items-center">
                  <span>Product return inquiry</span>
                  <span className="text-xs text-textMedium">Apr 15, 2023</span>
                </div>
                <p className="text-xs text-textMedium">Resolved by Alex</p>
              </div>
            </div>
          </div>
          
          <div>
            <h4 className="text-xs uppercase text-textMedium font-medium mb-1">Notes</h4>
            <div className="border border-gray-200 rounded-md p-2">
              <Textarea 
                className="w-full text-sm resize-none focus:outline-none h-20" 
                placeholder="Add notes about this customer..."
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
