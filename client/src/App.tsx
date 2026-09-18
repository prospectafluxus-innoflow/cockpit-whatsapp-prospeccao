import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import { lazy, Suspense } from "react";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import CockpitPage from "./pages/CockpitPage";
import KanbanPage from "./pages/KanbanPage";
import DashboardPage from "./pages/DashboardPage";
import SchedulePage from "./pages/SchedulePage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import AdminPage from "./pages/AdminPage";
import ProfilePage from "./pages/ProfilePage";
import InnoFlowPage from "./pages/InnoFlowPage";
import DashboardLayout from "./components/DashboardLayout";
import { FluxusLayout } from "./components/fluxus/FluxusLayout";

const FluxusLoginPage = lazy(() => import("./pages/FluxusLoginPage"));
const FluxusRegisterPage = lazy(() => import("./pages/FluxusRegisterPage"));
const FluxusHomePage = lazy(() => import("./pages/FluxusHomePage"));
const FluxusAssessmentPage = lazy(() => import("./pages/FluxusAssessmentPage"));
const FluxusAdminPage = lazy(() => import("./pages/FluxusAdminPage"));
const FluxusCompanyPage = lazy(() => import("./pages/FluxusCompanyPage"));
const FluxusAdminReportPage = lazy(
  () => import("./pages/FluxusAdminReportPage")
);

function Router() {
  return (
    <Switch>
      {/* Rotas públicas — sem DashboardLayout */}
      <Route path="/login" component={LoginPage} />
      <Route path="/register" component={RegisterPage} />
      <Route path="/forgot-password" component={ForgotPasswordPage} />
      <Route path="/reset-password" component={ResetPasswordPage} />
      <Route path="/fluxus/login" component={FluxusLoginPage} />
      <Route path="/fluxus/cadastro" component={FluxusRegisterPage} />

      {/* Área exclusiva do colaborador Fluxus */}
      <Route path="/fluxus/avaliacao">
        <FluxusLayout>
          <FluxusAssessmentPage />
        </FluxusLayout>
      </Route>
      <Route path="/fluxus">
        <FluxusLayout>
          <FluxusHomePage />
        </FluxusLayout>
      </Route>

      {/* Rotas protegidas — com DashboardLayout */}
      <Route>
        <DashboardLayout>
          <Switch>
            <Route path="/" component={CockpitPage} />
            <Route path="/cockpit" component={CockpitPage} />
            <Route path="/kanban" component={KanbanPage} />
            <Route path="/dashboard" component={DashboardPage} />
            <Route path="/schedule" component={SchedulePage} />
            <Route path="/innoflow" component={InnoFlowPage} />
            <Route path="/fluxus/admin" component={FluxusAdminPage} />
            <Route
              path="/fluxus/admin/empresa/:id"
              component={FluxusCompanyPage}
            />
            <Route
              path="/fluxus/admin/relatorio/:id"
              component={FluxusAdminReportPage}
            />
            <Route path="/admin" component={AdminPage} />
            <Route path="/profile" component={ProfilePage} />
            <Route path="/404" component={NotFound} />
            <Route component={NotFound} />
          </Switch>
        </DashboardLayout>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          <Suspense fallback={<div className="min-h-screen bg-background" />}>
            <Router />
          </Suspense>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
