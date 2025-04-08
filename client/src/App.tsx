import { Switch, Route, Redirect } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import CustomerChat from "@/pages/customer/CustomerChat";
import AgentDashboard from "@/pages/agent/AgentDashboard";
import AuthPage from "@/pages/auth-page";
import { ProtectedRoute } from "@/lib/protected-route";
import { AuthProvider } from "@/hooks/useAuth";
import { useAuth } from "@/hooks/useAuth";

function RouterContent() {
  const { user } = useAuth();
  
  return (
    <Switch>
      <Route path="/" component={() => {
        // If user is logged in as an agent, redirect to agent dashboard
        if (user && user.role === 'agent') {
          return <Redirect to="/agent" />;
        }
        // Otherwise show customer chat
        return <CustomerChat />;
      }} />
      <ProtectedRoute path="/agent">
        <AgentDashboard />
      </ProtectedRoute>
      <Route path="/auth" component={AuthPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function Router() {
  return (
    <RouterContent />
  );
}

function App() {
  return (
    <AuthProvider>
      <Router />
      <Toaster />
    </AuthProvider>
  );
}

export default App;
