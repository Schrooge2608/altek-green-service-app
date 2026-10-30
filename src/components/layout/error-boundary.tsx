'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TriangleAlert, RotateCcw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }
  
  private handleTryAgain = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  }

  public render() {
    if (this.state.hasError) {
      return (
          <div className="flex items-center justify-center min-h-[60vh] p-4 sm:p-8">
              <Card className="w-full max-w-xl text-center shadow-lg border-destructive/20 bg-white">
                  <CardHeader>
                      <CardTitle className="flex items-center justify-center gap-2 text-destructive">
                        <TriangleAlert className="h-6 w-6" />
                        Something went wrong
                      </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                      <p className="text-sm text-muted-foreground">An unexpected error occurred while rendering this page.</p>

                      {this.state.error?.message && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-left text-xs font-mono text-red-900 overflow-auto max-h-48 break-words">
                          <p className="font-bold text-red-800 mb-1">{this.state.error.name}: {this.state.error.message}</p>
                          {this.state.error.stack && (
                            <pre className="text-[10px] text-red-600 whitespace-pre-wrap">{this.state.error.stack}</pre>
                          )}
                        </div>
                      )}

                      <div className="flex items-center justify-center gap-3 pt-2">
                          <Button onClick={this.handleTryAgain} className="bg-primary gap-1.5">
                              <RotateCcw className="h-4 w-4" /> Try Again
                          </Button>
                          <Button variant="outline" onClick={() => window.location.href = '/'} className="gap-1.5">
                              <Home className="h-4 w-4" /> Dashboard
                          </Button>
                      </div>
                  </CardContent>
              </Card>
          </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
