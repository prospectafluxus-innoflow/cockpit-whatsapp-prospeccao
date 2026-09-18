import { cn } from "@/lib/utils";
import { reloadOnceAfterStaleAssetError } from "@/lib/chunkRecovery";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    if (reloadOnceAfterStaleAssetError(error)) return;
    console.error("[Application Error]", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center min-h-screen p-8 bg-background">
          <div className="flex flex-col items-center w-full max-w-2xl p-8">
            <AlertTriangle
              size={48}
              className="text-destructive mb-6 flex-shrink-0"
            />

            <h2 className="mb-3 text-xl font-semibold">
              Não foi possível carregar esta página
            </h2>

            <p className="mb-6 text-center text-sm text-muted-foreground">
              Atualize a página para carregar a versão mais recente da
              aplicação.
            </p>

            <div className="mb-6 w-full overflow-auto rounded bg-muted p-4">
              <pre className="text-sm text-muted-foreground whitespace-break-spaces">
                {this.state.error?.message}
              </pre>
            </div>

            <button
              onClick={() => window.location.reload()}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg",
                "bg-primary text-primary-foreground",
                "hover:opacity-90 cursor-pointer"
              )}
            >
              <RotateCcw size={16} />
              Atualizar página
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
