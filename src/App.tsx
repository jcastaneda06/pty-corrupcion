import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Navbar } from './components/layout/Navbar';
import { Dashboard } from './pages/Dashboard';
import { Findings } from './pages/Findings';
import { FindingDetail } from './pages/FindingDetail';
import { PersonDetail } from './pages/PersonDetail';
import { NotFound } from './pages/NotFound';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <div className="min-h-screen bg-dark-950 text-white">
          <Navbar />
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/hallazgos" element={<Findings />} />
            <Route path="/hallazgos/:id" element={<FindingDetail />} />
            <Route path="/personas/:id" element={<PersonDetail />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </div>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
