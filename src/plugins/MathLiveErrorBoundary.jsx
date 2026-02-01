import React from 'react';

class MathLiveErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    // Suppress ResizeObserver errors
    if (error?.message?.includes('ResizeObserver')) {
      return { hasError: false };
    }
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Suppress ResizeObserver errors silently
    if (error?.message?.includes('ResizeObserver')) {
      return;
    }
    // Log other errors
    console.error('MathLive Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return <div>Something went wrong with the math editor.</div>;
    }

    return this.props.children;
  }
}

export default MathLiveErrorBoundary;
