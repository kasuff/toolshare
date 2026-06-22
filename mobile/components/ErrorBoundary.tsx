import React, { Component, ErrorInfo, ReactNode } from "react";
import { View, Text, Button, StyleSheet } from "react-native";
import { colors, spacing } from "../constants/theme";

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
    console.error("Uncaught error in Mobile ErrorBoundary:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>Hoppla, ein Fehler ist aufgetreten</Text>
          <Text style={styles.subtitle}>
            Es ist ein unerwarteter Fehler aufgetreten. Bitte lade die App neu.
          </Text>
          {this.state.error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{this.state.error.message}</Text>
            </View>
          )}
          <Button title="App neu laden" onPress={() => this.setState({ hasError: false, error: null })} />
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.lg,
    backgroundColor: colors.background,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: colors.text,
    marginBottom: spacing.sm,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
    textAlign: "center",
  },
  errorBox: {
    backgroundColor: colors.surfaceHover,
    padding: spacing.md,
    borderRadius: 8,
    marginBottom: spacing.lg,
    width: "100%",
  },
  errorText: {
    color: colors.text,
    fontFamily: "monospace",
  },
});
