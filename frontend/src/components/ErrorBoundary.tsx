import { Component, ErrorInfo, ReactNode } from "react";
import { Surface } from "./ui";

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error in ErrorBoundary:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <section className="stack">
          <h1>Hoppla, ein Fehler ist aufgetreten</h1>
          <Surface title="Fehler in der Anwendung" subtitle="Es ist ein unerwarteter Fehler aufgetreten.">
            <div className="stack">
              <p>Wir bitten um Entschuldigung. Bitte versuche, die Seite neu zu laden.</p>
              <pre style={{ background: "var(--color-surface-hover)", padding: "1rem", borderRadius: "8px", overflowX: "auto" }}>
                {this.state.error?.message}
              </pre>
              <div className="row">
                <button className="btn" onClick={() => window.location.reload()}>
                  Seite neu laden
                </button>
              </div>
            </div>
          </Surface>
        </section>
      );
    }

    return this.props.children;
  }
}
