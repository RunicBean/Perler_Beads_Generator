import { t, localePath, getLocale } from './i18n';
import App from './App';

type AppErrorBoundaryState = { error: Error | null };

class AppErrorBoundary extends React.Component<React.PropsWithChildren, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <main className="app-fallback">
          <h1>Perler Beads Generator</h1>
          <p>{t('common.appError')}</p>
          <pre>{this.state.error.message}</pre>
          <button onClick={() => window.location.reload()}>{t('common.reload')}</button>
        </main>
      );
    }
    return this.props.children;
  }
}

// Preserve the old editor preference only here; public-page language is determined by its URL.
try { if (location.pathname === '/editor' && localStorage.getItem('perler-beads-generator:language') === 'en') location.replace('/en/editor' + location.search + location.hash); } catch {}
const legacy = location.hash.match(/^#marketplace(?:\/([a-f0-9-]{36}))?$/);
if (legacy) location.replace(localePath(legacy[1] ? `/patterns/${legacy[1]}` : '/marketplace'));

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </React.StrictMode>,
);
