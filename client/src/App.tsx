import { Switch, Route } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import CustomerChat from "@/pages/customer/CustomerChat";
import AgentDashboard from "@/pages/agent/AgentDashboard";

function Router() {
  return (
    <Switch>
      <Route path="/" component={CustomerChat} />
      <Route path="/agent" component={AgentDashboard} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <>
      <Router />
      <Toaster />
    </>
  );
}

export default App;
