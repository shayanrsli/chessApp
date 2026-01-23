import { useState, useEffect, useRef } from 'react';
import { useTelegramUser } from '../../hooks/useTelegramUser';
import { useSignalR } from "../../hooks/useSignalR";
import { getPlayerId, getPlayerName } from '../../utils/playerUtils';
import './PlayWithFriend.css';

export function PlayWithFriend({ onBack }: { onBack: () => void }) {
  const { username } = useTelegramUser();
  const { connection, isConnected } = useSignalR();
  const [mode, setMode] = useState<'create' | 'join'>('create');
  const [gameName, setGameName] = useState(`${username || 'Guest'}'s Game`);
  const [isPrivate, setIsPrivate] = useState(true);
  const [inviteCode, setInviteCode] = useState('');
  const [roomId, setRoomId] = useState('');
  const [createdGame, setCreatedGame] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const hasNavigatedRef = useRef(false);


  useEffect(() => {
  if (!connection) return;

  const handleGameStarted = (data: any) => {
    console.log('🚀 Game started event:', data);
    
    if (data.RoomId && !hasNavigatedRef.current) {
      hasNavigatedRef.current = true;
      console.log('🎮 GAME STARTED - Navigating to:', data.RoomId);
      
      setTimeout(() => {
        // 🔥 فقط dispatch event کن، نه reload صفحه
        window.dispatchEvent(new CustomEvent('navigateToGame', {
          detail: { roomId: data.RoomId }
        }));
      }, 500);
    }
  };

  const handlePlayerJoined = (data: any) => {
    console.log('👤 Player joined event:', data);
    setSuccess(`👤 ${data.Player?.Username} به بازی پیوست!`);
    
    if (createdGame && createdGame.roomId === data.RoomId) {
      setSuccess('🎮 بازیکن دوم پیوست! بازی به زودی شروع می‌شود...');
    }
  };

  connection.on('PlayerJoined', handlePlayerJoined);
  connection.on('GameStarted', handleGameStarted);

  return () => {
    if (connection) {
      connection.off('PlayerJoined', handlePlayerJoined);
      connection.off('GameStarted', handleGameStarted);
    }
  };
}, [connection, createdGame]);

  // 🔥 تابع ایجاد بازی با playerId
const handleCreateGame = async () => {

  console.log('🎮 Creating game:', { 
    gameName: gameName || "Guest's Game", 
    isPrivate: true, 
  });
  

  if (!isConnected || !connection) {
    setError('🔌 اتصال به سرور برقرار نیست');
    return;
  }

  setLoading(true);
  setError('');
  setSuccess('');

  try {
    const playerId = getPlayerId();
    const playerName = getPlayerName();

    console.log('🎮 Creating game:', {
      gameName,
      isPrivate,
      playerName,
      playerId
    });

    // ✅ فقط ایجاد بازی — هیچ Joinای اینجا نداریم
    const result = await connection.invoke(
      'CreateGame',
      gameName,
      playerName,
      playerId
    );


    console.log('🎮 CreateGame result:', result);

    if (!result?.success || !result.roomId) {

      setError(result?.message || '❌ خطا در ایجاد بازی');
      return;
    }

    // ✅ ذخیره اطلاعات فقط برای reconnect
    localStorage.setItem('last_room_id', result.roomId);
    localStorage.setItem('last_player_id', playerId);
    localStorage.setItem('last_player_color', 'white');

    setCreatedGame(result);
    setRoomId(result.roomId);
    setSuccess('✅ بازی با موفقیت ایجاد شد');

        console.log('💾 Saved roomId:', result.roomId);
    localStorage.setItem('my_room_id', result.roomId);

    // ✅ فقط یک بار navigate
    // if (!hasNavigatedRef.current) {
    //   hasNavigatedRef.current = true;
    // }

    // ✅ کپی کد دعوت (فقط اگر private بود)
    if (result.inviteCode) {
      await navigator.clipboard.writeText(result.inviteCode);

      setTimeout(() => {
        setSuccess(`✅ کد دعوت کپی شد: ${result.inviteCode}`);
      }, 1000);
    }
  } catch (error: any) {
    console.error('❌ CreateGame error:', error);
    setError(error?.message || '❌ خطای غیرمنتظره در ایجاد بازی');
  } finally {
    setLoading(false);
  }
};


  // 🔥 تابع join با کد دعوت با playerId
const handleJoinByCode = async () => {
  const cleanCode = inviteCode.trim().toUpperCase();

  if (!cleanCode) {
    setError('🔑 لطفاً کد دعوت را وارد کنید');
    return;
  }

  if (!isConnected || !connection) {
    setError('🔌 اتصال به سرور برقرار نیست');
    return;
  }

  setLoading(true);
  setError('');
  setSuccess('');

  try {
    const playerId = getPlayerId();
    const playerName = getPlayerName();

    console.log('🔑 Joining by invite code:', cleanCode, 'PlayerId:', playerId);

    // ✅ فراخوانی فقط JoinByInviteCode با playerId
    const result = await connection.invoke(
      'JoinByInviteCode',
      cleanCode,
      playerName,
      playerId
    );

    console.log('🔑 Join by invite code result:', result);

    if (!result?.success || !result.roomId) {
      setError(result?.message || '❌ خطا در پیوستن با کد دعوت');
      return;
    }

    // ✅ ذخیره اطلاعات برای reconnect
    localStorage.setItem('last_room_id', result.roomId);
    localStorage.setItem('last_player_color', result.yourColor);
    localStorage.setItem('last_player_id', playerId);

    setSuccess('✅ با موفقیت به بازی پیوستید!');

    // ✅ فقط یک بار navigate
    if (!hasNavigatedRef.current) {
      hasNavigatedRef.current = true;

      setTimeout(() => {
        console.log('📤 Navigating to game page:', result.roomId);

        window.dispatchEvent(
          new CustomEvent('navigateToGame', {
            detail: {
              roomId: result.roomId,
              invite: cleanCode
            }
          })
        );
      }, 500);
    }
  } catch (error: any) {
    console.error('❌ Error joining by invite code:', error);
    setError(error?.message || '❌ خطای غیرمنتظره در پیوستن با کد دعوت');
  } finally {
    setLoading(false);
  }
};


  // 🔥 تابع join با roomId با playerId
  const handleJoinById = async () => {
    if (!roomId.trim()) {
      setError('🆔 لطفاً شناسه بازی را وارد کنید');
      return;
    }

    if (!isConnected || !connection) {
      setError('🔌 اتصال برقرار نیست');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const playerId = getPlayerId();
      const playerName = getPlayerName();
      
      console.log('🆔 Joining by room ID:', roomId, 'PlayerId:', playerId);
      
      // 🔥 JoinGame با playerId
      const result = await connection.invoke('JoinGame', roomId, playerName, playerId);
      console.log('🆔 Join by room ID result:', result);

      if (result?.success) {
        const joinedRoomId = result.roomId || roomId;
        
        // ذخیره اطلاعات برای reconnect
        localStorage.setItem('last_room_id', joinedRoomId);
        localStorage.setItem('last_player_color', result.yourColor);
        localStorage.setItem('last_player_id', playerId);
        
        setSuccess('✅ با موفقیت به بازی پیوستید!');
        
        hasNavigatedRef.current = false;
        
        setTimeout(() => {
          console.log('📤 Sending to game page:', joinedRoomId);
          
          window.dispatchEvent(new CustomEvent('navigateToGame', {
            detail: { roomId: joinedRoomId }
          }));
        }, 1500);
      } else {
        const errorMsg = result?.message || '❌ خطا در پیوستن به بازی';
        setError(errorMsg);
        
        if (errorMsg.includes('بازی یافت نشد')) {
          setTimeout(() => {
            if (window.confirm('بازی یافت نشد. می‌خواهید بازی جدید ایجاد کنید؟')) {
              setMode('create');
            }
          }, 1000);
        }
      }
    } catch (error: any) {
      console.error('❌ Error joining by ID:', error);
      setError(`❌ خطا: ${error.message || 'در پیوستن به بازی'}`);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setSuccess('📋 کپی شد!');
    setTimeout(() => {
      setSuccess('✅ بازی ایجاد شد! منتظر بازیکن دوم...');
    }, 2000);
  };

  const shareToTelegram = () => {
    let text = 'به بازی شطرنج من بپیوند! 🎮\n';
    
    if (createdGame?.inviteCode) {
      text += `کد دعوت: ${createdGame.inviteCode}\n`;
    }
    if (createdGame?.roomId) {
      text += `شناسه بازی: ${createdGame.roomId}`;
    }
    
    const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(window.location.href)}&text=${encodeURIComponent(text)}`;
    window.open(telegramUrl, '_blank');
  };

  useEffect(() => {
    if (error || success) {
      const timer = setTimeout(() => {
        setError('');
        setSuccess('');
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, success]);

  return (
    <div className="play-with-friend" dir="rtl">
      <header className="friend-header">
        <button className="back-btn" onClick={onBack}>
          ← بازگشت
        </button>
        <h1>🎮 بازی با دوست</h1>
        <div className="connection-status">
          <span className={`status-dot ${isConnected ? 'connected' : 'disconnected'}`}></span>
          {isConnected ? 'آنلاین' : 'آفلاین'}
        </div>
      </header>

      <main className="friend-content">
        <div className="mode-tabs">
          <button 
            className={`tab-btn ${mode === 'create' ? 'active' : ''}`}
            onClick={() => setMode('create')}
          >
            🆕 ایجاد بازی
          </button>
          <button 
            className={`tab-btn ${mode === 'join' ? 'active' : ''}`}
            onClick={() => setMode('join')}
          >
            🔗 پیوستن
          </button>
        </div>

        {error && (
          <div className="alert alert-error">
            ⚠️ {error}
          </div>
        )}
        {success && (
          <div className="alert alert-success">
            ✅ {success}
          </div>
        )}

        {mode === 'create' ? (
          <div className="create-section">
            <h2>🆕 ایجاد بازی جدید</h2>
            
            <div className="form-group">
              <label>نام بازی:</label>
              <input
                type="text"
                value={gameName}
                onChange={(e) => setGameName(e.target.value)}
                placeholder="نام بازی"
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={isPrivate}
                  onChange={(e) => setIsPrivate(e.target.checked)}
                  disabled={loading}
                />
                <span>بازی خصوصی (با کد دعوت)</span>
              </label>
            </div>

            <button 
              className="primary-btn"
              onClick={handleCreateGame}
              disabled={loading || !isConnected}
            >
              {loading ? 'در حال ایجاد...' : '🎮 ایجاد بازی'}
            </button>

            {createdGame && (
              <div className="game-info">
                <h3>✅ بازی ایجاد شد</h3>
                
                <div className="info-item">
                  <strong>شناسه:</strong>
                  <div className="copy-field" onClick={() => copyToClipboard(createdGame.roomId)}>
                    <code>{createdGame.roomId}</code>
                    <span className="copy-icon">📋</span>
                  </div>
                </div>

                {createdGame.inviteCode && (
                  <div className="info-item">
                    <strong>کد دعوت:</strong>
                    <div className="copy-field" onClick={() => copyToClipboard(createdGame.inviteCode)}>
                      <code>{createdGame.inviteCode}</code>
                      <span className="copy-icon">📋</span>
                    </div>
                  </div>
                )}

                <div className="invite-actions">
                  <button className="telegram-btn" onClick={shareToTelegram}>
                    📨 اشتراک در تلگرام
                  </button>
                </div>

                <div className="waiting-note">
                  ⏳ منتظر بازیکن دوم...
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="join-section">
            <h2>🔗 پیوستن به بازی</h2>
            
            <div className="join-methods">
              <div className="join-method">
                <h3>🔑 با کد دعوت</h3>
                <div className="form-group">
                  <input
                    type="text"
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                    placeholder="کد دعوت (8 رقم)"
                    maxLength={8}
                    disabled={loading}
                    style={{ textTransform: 'uppercase' }}
                  />
                </div>
                <button 
                  className="join-btn"
                  onClick={handleJoinByCode}
                  disabled={loading || !inviteCode.trim()}
                >
                  {loading ? 'در حال اتصال...' : '🎮 پیوستن با کد دعوت'}
                </button>
              </div>

              <div className="divider">
                <span className="divider-text">یا</span>
              </div>

              <div className="join-method">
                <h3>🆔 با شناسه بازی</h3>
                <div className="form-group">
                  <input
                    type="text"
                    value={roomId}
                    onChange={(e) => setRoomId(e.target.value)}
                    placeholder="شناسه بازی"
                    disabled={loading}
                  />
                </div>
                <button 
                  className="join-btn"
                  onClick={handleJoinById}
                  disabled={loading || !roomId.trim()}
                >
                  {loading ? 'در حال اتصال...' : '🎮 پیوستن با شناسه'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="friend-footer">
        <p className="help-text">
          🤝 برای شروع بازی، یکی از دوستانتان را دعوت کنید یا به بازی دوست دیگری بپیوندید.
        </p>
      </footer>
    </div>
  );
}