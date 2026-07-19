import { useEffect, useState } from 'react';

function App() {
  const [estadoBackend, setEstadoBackend] = useState('verificando...');

  useEffect(() => {
    fetch('/api/health')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => setEstadoBackend(data.status))
      .catch(() => setEstadoBackend('sin conexión'));
  }, []);

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3">
        <span className="font-semibold text-gray-800">Plataforma QA</span>
        <span className="text-sm text-gray-500">Selector de proyecto</span>
      </header>
      <div className="flex flex-1 overflow-hidden">
        <aside className="w-56 border-r border-gray-200 bg-gray-50 p-4">
          <p className="text-sm text-gray-400">Módulos del proyecto</p>
        </aside>
        <main className="flex-1 overflow-y-auto p-6">
          <p className="text-gray-700">
            Estado del backend: <span className="font-mono">{estadoBackend}</span>
          </p>
        </main>
      </div>
    </div>
  );
}

export default App;
