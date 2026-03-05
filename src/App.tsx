import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AuthModal } from './components/auth/AuthModal';
import { Navbar } from './components/layout/Navbar';
import { Dashboard } from './pages/Dashboard';
import { Findings } from './pages/Findings';
import { FindingDetail } from './pages/FindingDetail';
import { PersonDetail } from './pages/PersonDetail';
import { NotFound } from './pages/NotFound';
import { CorruptionIndex } from './pages/CorruptionIndex';
import { Estadisticas } from './pages/Estadisticas';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
});

function AuthModalWrapper() {
  const { isAuthModalOpen, closeAuthModal } = useAuth();
  if (!isAuthModalOpen) return null;
  return <AuthModal key="auth-modal" />;
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <div className="min-h-screen bg-dark-950 text-white">
            <Navbar />
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/hallazgos" element={<Findings />} />
              <Route path="/hallazgos/:id" element={<FindingDetail />} />
              <Route path="/personas/:id" element={<PersonDetail />} />
              <Route path="/indice" element={<CorruptionIndex />} />
              <Route path="/estadisticas" element={<Estadisticas />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </div>
          <AuthModalWrapper />
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
