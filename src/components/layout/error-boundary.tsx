'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TriangleAlert } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(_: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // You can also log the error to an error reporting service
    console.error("Uncaught error:", error, errorInfo);
  }
  
  // This will force a hard refresh of the page.
  private handleTryAgain = () => {
    window.location.reload();
  }

  public render() {
    if (this.state.hasError) {
      // You can render any custom fallback UI
      return (
          <div className="flex items-center justify-center h-full p-8">
              <Card className="w-full max-w-md text-center">
                  <CardHeader>
                      <CardTitle className="flex items-center justify-center gap-2">
                        <TriangleAlert className="h-6 w-6 text-destructive" />
                        Something went wrong
                      </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                      <p className="text-muted-foreground">Something went wrong here.</p>
                      <Button onClick={this.handleTryAgain}>
                          Try Again
                      </Button>
                  </CardContent>
              </Card>
          </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
