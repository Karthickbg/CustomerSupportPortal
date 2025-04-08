import { useState, useEffect } from "react";
import { useLocation, useRoute, Redirect } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { ArrowRight, Users, Lock } from "lucide-react";

export default function AuthPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [tab, setTab] = useState("login");
  const { user, login, isLoading } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  // If user is already logged in, redirect to dashboard
  useEffect(() => {
    if (user) {
      navigate("/");
    }
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!username || !password) {
      toast({
        title: "Missing information",
        description: "Please provide both username and password",
        variant: "destructive",
      });
      return;
    }
    
    if (tab === "login") {
      const success = await login(username, password);
      if (success) {
        navigate("/");
      }
    } else {
      toast({
        title: "Registration not implemented",
        description: "Please use one of the existing agent accounts: sarah_agent, alex_agent, or michael_agent. All have password: password123",
        variant: "destructive",
      });
    }
  };

  if (user) {
    return <Redirect to="/" />;
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <div className="max-w-6xl w-full grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
        {/* Hero Section */}
        <div className="hidden lg:flex flex-col space-y-6">
          <h1 className="text-4xl font-bold tracking-tight">
            Customer Service Chat Platform
          </h1>
          <p className="text-xl text-muted-foreground max-w-md">
            A powerful tool for customer service agents to manage chat conversations with customers in real-time.
          </p>
          <div className="space-y-4">
            <div className="flex items-start space-x-3">
              <div className="bg-primary/10 p-2 rounded-full mt-1">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold">Multi-agent Support</h3>
                <p className="text-muted-foreground">
                  Multiple agents can handle customer inquiries simultaneously.
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="bg-primary/10 p-2 rounded-full mt-1">
                <Lock className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold">Secure Communication</h3>
                <p className="text-muted-foreground">
                  End-to-end encrypted conversations between agents and customers.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Auth Form */}
        <Card className="w-full max-w-md mx-auto shadow-lg">
          <CardHeader className="space-y-2">
            <CardTitle className="text-2xl font-bold text-center">
              Agent Login
            </CardTitle>
            <CardDescription className="text-center">
              Sign in to your agent account to manage customer chats
            </CardDescription>
          </CardHeader>
          <div className="w-full">
            <div className="flex border-b">
              <button
                type="button"
                className={`px-4 py-2 text-center w-1/2 ${tab === 'login' ? 'border-b-2 border-primary font-medium' : 'text-muted-foreground'}`}
                onClick={() => setTab('login')}
              >
                Login
              </button>
              <button
                type="button"
                className={`px-4 py-2 text-center w-1/2 ${tab === 'register' ? 'border-b-2 border-primary font-medium' : 'text-muted-foreground'}`}
                onClick={() => setTab('register')}
              >
                Register
              </button>
            </div>
            
            {tab === 'login' && (
              <form onSubmit={handleSubmit}>
                <CardContent className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="username">Username</Label>
                    <Input
                      id="username"
                      type="text"
                      placeholder="Enter your username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      disabled={isLoading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={isLoading}
                    />
                  </div>
                </CardContent>
                <CardFooter>
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={isLoading}
                  >
                    {isLoading ? "Logging in..." : "Login"} <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </CardFooter>
              </form>
            )}
            
            {tab === 'register' && (
              <CardContent className="pt-4 text-center text-muted-foreground">
                <p>
                  Registration is disabled in this demo.<br />
                  Please use one of the existing agent accounts:
                </p>
                <div className="mt-4 p-3 bg-muted rounded-md">
                  <p className="font-mono text-sm">
                    Username: sarah_agent, alex_agent, or michael_agent<br />
                    Password: password123
                  </p>
                </div>
              </CardContent>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}