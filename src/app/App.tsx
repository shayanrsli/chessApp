import { useState } from 'react';
import { Home } from '../pages/Home'
import { ChessBoard } from '../features/chess/ChessBoard';

type AppView = 'home' | 'playWithFriend' | 'playWithBot';

function App() {
  const [currentView, setCurrentView] = useState<AppView>('home');

  const renderView = () => {
    switch (currentView) {
      case 'home':
        return <Home onNavigate={setCurrentView} />;
      case 'playWithFriend':
        return <ChessBoard mode="friend" onBack={() => setCurrentView('home')} />;
      case 'playWithBot':
        return <ChessBoard mode="bot" onBack={() => setCurrentView('home')} />;
      default:
        return <Home onNavigate={setCurrentView} />;
    }
  };

  return (
    <div className="app">
      {renderView()}
    </div>
  );
}

export default App;