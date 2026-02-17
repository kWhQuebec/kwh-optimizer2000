import { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackMessage?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[ErrorBoundary] Caught error:", error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      const title = this.props.fallbackTitle || "Une erreur est survenue";
      const message =
        this.props.fallbackMessage ||
        "Les données de cette présentation n'ont pas pu être chargées correctement. Veuillez réessayer.";

      return (
        <div style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "60vh",
          padding: "2rem",
          textAlign: "center",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}>
          <AlertTriangle size={48} color="#DC2626" style={{ marginBottom: "1rem" }} />
          <h2 style={{ fontSize: "1.5rem", fontWeight: 600, color: "#1f2937", marginBottom: "0.5rem" }}>
            {title}
          </h2>
          <p style={{ color: "#6b7280", maxWidth: "28rem", marginBottom: "1.5rem", lineHeight: 1.6 }}>
            {message}
          </p>
          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button
              onClick={this.handleReset}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.5rem",
                padding: "0.625rem 1.25rem",
                backgroundColor: "#003DA6",
                color: "white",
                border: "none",
                borderRadius: "0.5rem",
                cursor: "pointer",
                fontSize: "0.875rem",
                fontWeight: 500,
              }}
            >
              <RefreshCw size={16} />
              Réessayer
            </button>
            <button
              onClick={() => window.location.href = "/"}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.5rem",
                padding: "0.625rem 1.25rem",
                backgroundColor: "transparent",
                color: "#003DA6",
                border: "1px solid #003DA6",
                borderRadius: "0.5rem",
                cursor: "pointer",
                fontSize: "0.875rem",
                fontWeight: 500,
              }}
            >
              Retour à l'accueil
            </button>
          </div>
          {process.env.NODE_ENV === "development" && this.state.error && (
            <pre style={{
              marginTop: "2rem",
              padding: "1rem",
              backgroundColor: "#fef2f2",
              borderRadius: "0.5rem",
              fontSize: "0.75rem",
              color: "#991b1b",
              maxWidth: "40rem",
              overflow: "auto",
              textAlign: "left",
            }}>
              {this.state.error.message}
              {"\n"}
              {this.state.error.stack}
            </pre>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
