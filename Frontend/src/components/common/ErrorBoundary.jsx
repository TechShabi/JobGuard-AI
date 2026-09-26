import { Component } from "react";

// Sprint 2 audit fix (Critical #4): the app previously had no React error
// boundary anywhere. Any unhandled render error in any page component would
// white-screen the entire application with no recovery path for the user.
// This wraps the whole app once, at the root, so a crash in any single page
// degrades to a recoverable in-app message instead of a blank screen.
//
// Deliberately minimal and unstyled-beyond-existing-classes — this is a
// stability fix, not a design-system pass.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    // Keep using the app's existing error logging convention.
    console.error("Unhandled error caught by ErrorBoundary:", error, info);
  }

  handleReload = () => {
    this.setState({ hasError: false });
    window.location.href = "/";
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            padding: "40px 20px",
          }}
        >
          <h1 style={{ fontSize: "22px", fontWeight: 700, marginBottom: "8px" }}>
            Something went wrong
          </h1>
          <p style={{ opacity: 0.7, marginBottom: "20px", maxWidth: "420px" }}>
            An unexpected error occurred. Your data is safe — try reloading the page.
          </p>
          <button className="btn-primary" onClick={this.handleReload}>
            Reload JobGuard AI
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
