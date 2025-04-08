import { createContext, ReactNode, useContext, useState, useEffect } from "react";
import { User } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "./use-toast";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  error: string | null;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // Check for stored user on mount
  useEffect(() => {
    const storedUser = localStorage.getItem('currentUser');
    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);
      } catch (e) {
        localStorage.removeItem('currentUser');
      }
    }
    setIsLoading(false);
  }, []);

  // Login function
  const login = async (username: string, password: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    try {
      // Find user by username
      const users = await apiRequest('GET', `/api/users`).then(res => res.json());
      const foundUser = users.find((u: User) => u.username === username);
      
      if (!foundUser) {
        throw new Error('User not found');
      }
      
      // In a real app, you would validate the password on the server
      // Here we're just checking if it matches the stored password
      if (foundUser.password !== password) {
        throw new Error('Invalid password');
      }

      // Only allow agents to log in to the agent dashboard
      if (foundUser.role !== 'agent') {
        throw new Error('Only agents can log in to the agent dashboard');
      }
      
      // Store the user in local storage
      localStorage.setItem('currentUser', JSON.stringify(foundUser));
      setUser(foundUser);
      
      toast({
        title: "Login successful",
        description: `Welcome back, ${foundUser.displayName}!`,
      });
      
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed';
      setError(message);
      
      toast({
        title: "Login failed",
        description: message,
        variant: "destructive",
      });
      
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Logout function
  const logout = () => {
    localStorage.removeItem('currentUser');
    setUser(null);
    
    toast({
      title: "Logged out",
      description: "You have been logged out successfully.",
    });
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        error,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}