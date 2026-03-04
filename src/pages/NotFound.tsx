import { Link } from 'react-router-dom';
import { Home, AlertCircle } from 'lucide-react';

export function NotFound() {
  return (
    <main className="max-w-lg mx-auto px-4 py-24 text-center">
      <AlertCircle className="w-16 h-16 text-gray-600 mx-auto mb-4" />
      <h1 className="text-4xl font-bold text-white mb-2">404</h1>
      <p className="text-gray-400 mb-6">Página no encontrada</p>
      <Link
        to="/"
        className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
      >
        <Home className="w-4 h-4" />
        Volver al inicio
      </Link>
    </main>
  );
}
