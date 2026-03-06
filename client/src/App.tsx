import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";

// Pages
import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import NovelList from "./pages/NovelList";
import NovelDetail from "./pages/NovelDetail";
import Outline from "./pages/Outline";
import Chapters from "./pages/Chapters";
import Knowledge from "./pages/Knowledge";
import ModelConfig from "./pages/ModelConfig";
import History from "./pages/History";
import Profile from "./pages/Profile";
import Admin from "./pages/Admin";
import Worldbuilding from "./pages/Worldbuilding";
import Search from "./pages/Search";
import PromptTemplates from "./pages/PromptTemplates";
import Reader from "./pages/Reader";

function Router() {
  return (
    <Switch>
      {/* Public routes */}
      <Route path="/" component={Home} />
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />

      {/* Protected routes */}
      <Route path="/novels" component={NovelList} />
      <Route path="/novels/:id" component={NovelDetail} />
      <Route path="/novels/:id/outline" component={Outline} />
      <Route path="/novels/:id/chapters" component={Chapters} />
      <Route path="/novels/:id/knowledge" component={Knowledge} />
      <Route path="/novels/:id/worldbuilding" component={Worldbuilding} />
      <Route path="/novels/:id/search" component={Search} />
      <Route path="/novels/:id/read" component={Reader} />
      <Route path="/novels/:id/read/:chapterId" component={Reader} />

      {/* User routes */}
      <Route path="/model-config" component={ModelConfig} />
      <Route path="/history" component={History} />
      <Route path="/profile" component={Profile} />
      <Route path="/prompt-templates" component={PromptTemplates} />

      {/* Admin routes */}
      <Route path="/admin" component={Admin} />

      {/* Fallback */}
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
