import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Adrift render failed:', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <main className="boot-fallback">
          <section className="glass boot-card">
            <p className="eyebrow">Adrift</p>
            <h1>畫面載入時遇到錯誤</h1>
            <p>{this.state.error.message}</p>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}
