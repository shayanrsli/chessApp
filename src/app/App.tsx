import { useState, useEffect } from 'react';
import { Home } from '../pages/Home';
import { ChessBoard } from '../features/chess/ChessBoard';
import { PlayWithFriend } from '../pages/PlayWithFriend/PlayWithFriend';
import { ChessMultiplayer } from '../components/ChessMultiplayer/ChessMultiplayer';

type AppView = 'home' | 'playWithFriend' | 'playWithBot' | 'multiplayerGame';

function App() {
  const [currentView, setCurrentView] = useState<AppView>('home');
  const [gameRoomId, setGameRoomId] = useState<string>('');
    const [isNavigating, setIsNavigating] = useState(false); // 🔥 جدید


    useEffect(() => {
  const handleNavigateToGame = (event: any) => {
    console.log('🎮 Navigating to game:', event.detail);
    
    const roomId = event.detail?.roomId;
    
    if (!roomId) {
      console.error('❌ RoomId is undefined!', event);
      return;
    }
    
    console.log('✅ Setting game room and changing view...');
    setGameRoomId(roomId);
    setCurrentView('multiplayerGame');
    
    console.log('✅ Navigation successful to room:', roomId);
  };

  window.addEventListener('navigateToGame', handleNavigateToGame as EventListener);

  return () => {
    window.removeEventListener('navigateToGame', handleNavigateToGame as EventListener);
  };
}, []);


const renderView = () => {
    switch (currentView) {
      case 'home':
        return <Home onNavigate={setCurrentView} />;
      case 'playWithBot':
        return <ChessBoard onBack={() => setCurrentView('home')} />;
      case 'playWithFriend':
        return <PlayWithFriend onBack={() => setCurrentView('home')} />;
      case 'multiplayerGame':
        // 🔥 این خط هم اضافه کن - بررسی کن gameRoomId خالی نباشد
        if (!gameRoomId) {
          return (
            <div className="error-page">
              <h2>❌ خطا در بارگذاری بازی</h2>
              <p>شناسه بازی نامعتبر است</p>
              <button 
                className="back-btn" 
                onClick={() => setCurrentView('home')}
              >
                ← بازگشت به خانه
              </button>
            </div>
          );
        }
        
        return (
          <ChessMultiplayer 
            roomId={gameRoomId} 
            onBack={() => setCurrentView('home')}
            onNewGame={() => setCurrentView('playWithFriend')}
          />
        );
      default:
        return <Home onNavigate={setCurrentView} />;
    }
  };

  return (
    <div className="app" dir="rtl">
      {renderView()}
    </div>
  );
}

export default App;