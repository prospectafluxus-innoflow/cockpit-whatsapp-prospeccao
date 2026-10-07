import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, useLocation } from "wouter";
import { lazy, Suspense, useEffect } from "react";
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
import FluxusAssessmentPage from "./pages/FluxusAssessmentPage";
import { isPersonaRoute } from "./lib/personaUiScope";

const FluxusLoginPage = lazy(() => import("./pages/FluxusLoginPage"));
const FluxusRegisterPage = lazy(() => import("./pages/FluxusRegisterPage"));
const FluxusHomePage = lazy(() => import("./pages/FluxusHomePage"));
const FluxusAdminPage = lazy(() => import("./pages/FluxusAdminPage"));
const FluxusCompanyPage = lazy(() => import("./pages/FluxusCompanyPage"));
const FluxusHistoryPage = lazy(() => import("./pages/FluxusHistoryPage"));
const FluxusTeamDashboardPage = lazy(
  () => import("./pages/FluxusTeamDashboardPage")
);
const FluxusPrivacyPage = lazy(() => import("./pages/FluxusPrivacyPage"));
const FluxusMethodPage = lazy(() => import("./pages/FluxusMethodPage"));
const FluxusAdminReportPage = lazy(
  () => import("./pages/FluxusAdminReportPage")
);
const FeedbackWorkspacePage = lazy(() =>
  import("./pages/FeedbackPages").then(module => ({
    default: module.default,
  }))
);
const FeedbackCyclePage = lazy(() =>
  import("./pages/FeedbackPages").then(module => ({
    default: module.FeedbackCyclePage,
  }))
);
const FeedbackEvaluationPage = lazy(() =>
  import("./pages/FeedbackPages").then(module => ({
    default: module.FeedbackEvaluationPage,
  }))
);
const FeedbackHistoryPage = lazy(() =>
  import("./pages/FeedbackPages").then(module => ({
    default: module.FeedbackHistoryPage,
  }))
);
const FeedbackTechnicalAdminPage = lazy(() =>
  import("./pages/FeedbackPages").then(module => ({
    default: module.FeedbackTechnicalAdminPage,
  }))
);

function ApplicationTitle() {
  const [location] = useLocation();

  useEffect(() => {
    const persona = isPersonaRoute(location);
    document.title = persona ? "Fluxus Persona | InnoFlow" : "ProspectaFluxus";
    if (persona) document.body.dataset.personaUi = "true";
    else delete document.body.dataset.personaUi;
    return () => {
      delete document.body.dataset.personaUi;
    };
  }, [location]);

  return null;
}

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

      {/* Feedback EEC — workspace, ciclos, avaliações e histórico */}
      <Route path="/fluxus/feedback/ciclo/:id">
        {params => (
          <FluxusLayout>
            <FeedbackCyclePage params={params} />
          </FluxusLayout>
        )}
      </Route>
      <Route path="/fluxus/feedback/avaliacao/:id">
        {params => (
          <FluxusLayout>
            <FeedbackEvaluationPage params={params} />
          </FluxusLayout>
        )}
      </Route>
      <Route path="/fluxus/feedback/historico">
        <FluxusLayout>
          <FeedbackHistoryPage />
        </FluxusLayout>
      </Route>
      <Route path="/fluxus/feedback">
        <FluxusLayout>
          <FeedbackWorkspacePage />
        </FluxusLayout>
      </Route>

      {/* Área exclusiva do colaborador Fluxus */}
      <Route path="/fluxus/avaliacao">
        <FluxusLayout>
          <FluxusAssessmentPage />
        </FluxusLayout>
      </Route>
      <Route path="/fluxus/historico">
        <FluxusLayout>
          <FluxusHistoryPage />
        </FluxusLayout>
      </Route>
      <Route path="/fluxus/equipe">
        <FluxusLayout>
          <FluxusTeamDashboardPage />
        </FluxusLayout>
      </Route>
      <Route path="/fluxus/relatorio/:id">
        {params => (
          <FluxusLayout>
            <FluxusAdminReportPage params={params} />
          </FluxusLayout>
        )}
      </Route>
      <Route path="/fluxus/privacidade">
        <FluxusLayout>
          <FluxusPrivacyPage />
        </FluxusLayout>
      </Route>
      <Route path="/fluxus/metodologia">
        <FluxusLayout>
          <FluxusMethodPage />
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
            <Route
              path="/fluxus/admin/feedback/empresa/:id"
              component={FeedbackTechnicalAdminPage}
            />
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
          <ApplicationTitle />
          <Suspense fallback={<div className="min-h-screen bg-background" />}>
            <Router />
          </Suspense>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
