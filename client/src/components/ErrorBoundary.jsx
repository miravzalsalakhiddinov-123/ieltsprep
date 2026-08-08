import { Component } from 'react';

// Without this, any uncaught error anywhere in the tree (a bad response from
// the test file's own JS, a network hiccup fetching the audio, etc.) took
// down the whole React app to a blank white screen with no way back except a
// manual hard refresh — which looked like "the site crashed". This catches
// that, shows a plain message, and offers a reload button. It intentionally
// reassures the student that their answers/timer/audio position are saved
// (see TestRunner's draft/timer/audio-position persistence) so reloading is
// safe rather than something to be afraid of.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error('Uncaught error in app tree:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            padding: 24,
            textAlign: 'center',
            fontFamily: 'inherit'
          }}
        >
          <div style={{ fontSize: 40 }}>⚠️</div>
          <h2 style={{ margin: 0 }}>Something went wrong</h2>
          <p style={{ color: '#666', maxWidth: 420, margin: 0 }}>
            Your answers, timer, and audio progress are saved automatically, so it's safe to reload.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '10px 22px',
              borderRadius: 8,
              border: 'none',
              background: '#4f46e5',
              color: '#fff',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: 15
            }}
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
