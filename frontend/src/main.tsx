import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Provider } from 'react-redux'
import { store } from './store'
import App from './App'
import './index.css'

// Global error boundary — shows crash reason on screen instead of blank page
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { error: null }
  }
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{
          minHeight: '100vh', background: '#0e0e12', color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexDirection: 'column', gap: '16px', padding: '24px', fontFamily: 'monospace',
        }}>
          <div style={{ fontSize: '48px' }}>⚠️</div>
          <h1 style={{ color: '#e06565', fontSize: '20px', margin: 0 }}>
            App crashed — copy this error and send to developer
          </h1>
          <pre style={{
            background: '#1e1e28', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '12px', padding: '20px', maxWidth: '700px',
            width: '100%', overflowX: 'auto', fontSize: '13px',
            color: '#f97316', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
          }}>
            {this.state.error.toString()}
            {'\n\n'}
            {this.state.error.stack}
          </pre>
        </div>
      )
    }
    return this.props.children
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <Provider store={store}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </Provider>
    </ErrorBoundary>
  </React.StrictMode>
)
