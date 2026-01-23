import { useState, useEffect, useRef, useCallback } from "react";
import { Chess, type Square } from "chess.js";
import { Chessground as CG } from "chessground";
import type { Api, Key } from "chessground/api";
import { useSignalR } from "../../hooks/useSignalR";
import { getPlayerId, getPlayerName } from "../../utils/playerUtils";
import "chessground/assets/chessground.base.css";
import "chessground/assets/chessground.brown.css";
import "chessground/assets/chessground.cburnett.css";
import "./ChessMultiplayer.css";

interface ChessMultiplayerProps {
  roomId: string;
  onBack: () => void;
  onNewGame?: () => void;
}

export function ChessMultiplayer({ roomId, onBack, onNewGame }: ChessMultiplayerProps) {
  const { connection, isConnected } = useSignalR();
  
  // Refs
  const boardRef = useRef<HTMLDivElement>(null);
  const cgRef = useRef<Api | null>(null);
  const gameRef = useRef<Chess | null>(null);
  const playerColorRef = useRef<'white' | 'black' | null>(null);
  const messageTimeoutRef = useRef<NodeJS.Timeout>();
  const isMountedRef = useRef(true);
  const joinedRef = useRef(false);

  // State
  const [playerColor, setPlayerColor] = useState<'white' | 'black' | null>(null);
  const [opponentName, setOpponentName] = useState('در انتظار حریف');
  const [gameStatus, setGameStatus] = useState<'waiting' | 'playing' | 'finished'>('waiting');
  const [isMyTurn, setIsMyTurn] = useState(false);
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [myTime, setMyTime] = useState(300);
  const [opponentTime, setOpponentTime] = useState(300);
  const [activeTimer, setActiveTimer] = useState<'me' | 'opponent'>('me');
  const [moveCount, setMoveCount] = useState(0);
  const [chatMessages, setChatMessages] = useState<Array<{sender: string, text: string, time: string}>>([]);
  const [newMessage, setNewMessage] = useState('');
  const [winner, setWinner] = useState<'white' | 'black' | 'draw' | null>(null);

  // Get player info
  const playerId = getPlayerId();
  const playerName = getPlayerName();

  // ✅ فقط برای mount / unmount
  useEffect(() => {
    isMountedRef.current = true;
    console.log('🎯 ChessMultiplayer mounted, roomId:', roomId);

    return () => {
      isMountedRef.current = false;
      joinedRef.current = false;
      console.log('🧹 ChessMultiplayer unmounted');
    };
  }, [roomId]);

  // Initialize chess game
  useEffect(() => {
    if (!gameRef.current) {
      gameRef.current = new Chess();
      console.log('♟️ Chess game initialized');
    }
  }, []);

  const showMessage = useCallback((msg: string, duration: number = 3000) => {
    if (!isMountedRef.current) return;
    
    if (messageTimeoutRef.current) {
      clearTimeout(messageTimeoutRef.current);
    }
    
    setMessage(msg);
    
    if (duration > 0) {
      messageTimeoutRef.current = setTimeout(() => {
        if (isMountedRef.current) {
          setMessage('');
        }
      }, duration);
    }
  }, []);

  const clearMessage = useCallback(() => {
    if (messageTimeoutRef.current) {
      clearTimeout(messageTimeoutRef.current);
    }
    if (isMountedRef.current) {
      setMessage('');
    }
  }, []);


// ✅ ثبت eventهای SignalR (خیلی مهم)
useEffect(() => {
  console.log('🔌 ChessMultiplayer useEffect for events, connection:', !!connection);
  
  if (!connection) {
    console.warn('❌ No connection for events, will retry...');
    return;
  }

  console.log('✅ Connection available, setting up event listeners...');

  const onGameStarted = (data: any) => {
    console.log('🚀 GameStarted received in ChessMultiplayer:', data);

    if (!isMountedRef.current) return;

    // 🔥 تشخیص رنگ با UserId
    const isWhite = data.WhitePlayer?.UserId === playerId;
    const isBlack = data.BlackPlayer?.UserId === playerId;
    
    console.log(`🎯 Checking UserId match in ChessMultiplayer:`);
    console.log(`   My UserId: ${playerId}`);
    console.log(`   White UserId: ${data.WhitePlayer?.UserId}`);
    console.log(`   Black UserId: ${data.BlackPlayer?.UserId}`);
    console.log(`   Is White? ${isWhite}`);
    console.log(`   Is Black? ${isBlack}`);
    
    let color: 'white' | 'black';
    
    if (isWhite) {
      color = 'white';
      console.log(`🎯 UserId match: WHITE`);
    } else if (isBlack) {
      color = 'black';
      console.log(`🎯 UserId match: BLACK`);
    } else {
      // Fallback to ConnectionId
      console.log(`⚠️ UserId not found, falling back to ConnectionId`);
      const fallbackIsWhite = data.WhitePlayer?.ConnectionId === connection.connectionId;
      color = fallbackIsWhite ? 'white' : 'black';
      console.log(`🎯 Fallback to ConnectionId: ${color}`);
    }
    
    playerColorRef.current = color;
    setPlayerColor(color);
    setOpponentName(color === 'white' ? data.BlackPlayer?.Username : data.WhitePlayer?.Username || 'حریف');
    setGameStatus('playing');
    setIsMyTurn(data.CurrentTurn === color);
    
    if (color === 'white') {
      showMessage('🎮 بازی شروع شد! شما سفید هستید و نوبت شماست.', 5000);
      setActiveTimer('me');
    } else {
      showMessage('🎮 بازی شروع شد! شما سیاه هستید. منتظر حرکت سفید...', 5000);
      setActiveTimer('opponent');
    }
    
    // بارگذاری تخته
    if (data.Board) {
      try {
        gameRef.current?.load(data.Board);
        updateBoard();
        console.log('✅ Board loaded successfully in ChessMultiplayer');
      } catch (error) {
        console.error('Error loading board:', error);
        gameRef.current?.reset();
        updateBoard();
      }
    }
  };

  const onPlayerJoined = (data: any) => {
    console.log('👤 PlayerJoined in ChessMultiplayer:', data);
    if (!isMountedRef.current) return;

    setOpponentName(data?.Player?.Username || 'حریف');
    showMessage(`👤 ${data?.Player?.Username || 'بازیکن جدید'} به بازی پیوست!`, 3000);
  };

  // ثبت eventها
  connection.on('GameStarted', onGameStarted);
  connection.on('PlayerJoined', onPlayerJoined);
  // connection.on('MoveMade', onMoveMade);
  // connection.on('GameMessage', onGameMessage);
  // connection.on('DrawOffered', onDrawOffered);
  // connection.on('PlayerResigned', onPlayerResigned);

  console.log('✅ Event listeners set up in ChessMultiplayer');

  return () => {
    console.log('🧹 Cleaning up event listeners in ChessMultiplayer');
    if (connection) {
      connection.off('GameStarted', onGameStarted);
      connection.off('PlayerJoined', onPlayerJoined);
      // connection.off('MoveMade', onMoveMade);
      // connection.off('GameMessage', onGameMessage);
      // connection.off('DrawOffered', onDrawOffered);
      // connection.off('PlayerResigned', onPlayerResigned);
    }
  };
}, [connection, playerId, showMessage]); // 🔥 اضافه کردن connection به dependency

// ✅ JoinGame (بدون شکستن Rules of Hooks)
useEffect(() => {
  const joinGame = async () => {
    if (!connection || !isConnected) {
      console.log('⏳ Waiting for connection...');
      return;
    }
    
    if (!roomId) {
      console.error('❌ No roomId provided');
      setIsLoading(false);
      return;
    }
    
    if (joinedRef.current) {
      console.log('⚠️ Already joined this game');
      return;
    }

    joinedRef.current = true;

    console.log('🎮 Joining game:', roomId, playerId);

    try {
      const result = await connection.invoke('JoinGame', roomId, playerName, playerId);
      console.log('✅ JoinGame result:', result);

      if (!isMountedRef.current) return;

      if (!result?.success) {
        console.error('❌ JoinGame failed:', result?.message);
        setIsLoading(false);
        showMessage(result?.message || '❌ خطا در ورود به بازی', 5000);
        return;
      }

      playerColorRef.current = result.yourColor;
      setPlayerColor(result.yourColor);
      setOpponentName(result.opponent || 'در انتظار حریف');
      
      localStorage.setItem('last_room_id', roomId);
      localStorage.setItem('last_player_color', result.yourColor);
      
      if (result.isReconnecting) {
        showMessage(`🔄 ${result.message || 'دوباره متصل شدید'}`, 3000);
      } else {
        if (result.yourColor === 'white') {
          showMessage('⚪ شما سفید هستید. منتظر بازیکن دوم...', 5000);
        } else {
          showMessage('⚫ شما سیاه هستید. بازی به زودی شروع می‌شود...', 5000);
        }
      }
      
      setIsLoading(false);
    } catch (err: any) {
      console.error('❌ JoinGame error:', err);
      if (isMountedRef.current) {
        setIsLoading(false);
        showMessage('❌ خطا در اتصال به سرور', 5000);
        // 🔥 Retry after 2 seconds
        setTimeout(() => {
          if (isMountedRef.current && !joinedRef.current) {
            console.log('🔄 Retrying JoinGame...');
            joinedRef.current = false;
          }
        }, 2000);
      }
    }
  };

  joinGame();
}, [connection, isConnected, roomId, playerId, playerName, showMessage]);

  // Timer effect
  useEffect(() => {
    if (gameStatus !== 'playing') return;

    const timer = setInterval(() => {
      if (!isMountedRef.current) return;
      
      if (activeTimer === 'me') {
        setMyTime(prev => {
          if (prev <= 1) {
            handleTimeout();
            return 0;
          }
          return prev - 1;
        });
      } else {
        setOpponentTime(prev => {
          if (prev <= 1) {
            handleTimeout();
            return 0;
          }
          return prev - 1;
        });
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [gameStatus, activeTimer]);

  // Helper functions
  const calculateDests = useCallback(() => {
    if (!gameRef.current || gameStatus !== 'playing') return new Map<Key, Key[]>();
    
    const game = gameRef.current;
    const dests = new Map<Key, Key[]>();
    const board = game.board();
    
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = board[row][col];
        if (piece && piece.color === game.turn()) {
          const square = `${String.fromCharCode(97 + col)}${8 - row}` as Key;
          try {
            const moves = game.moves({ square: square as Square, verbose: true });
            if (moves.length > 0) {
              const destSquares = moves.map(m => m.to as Key);
              dests.set(square, destSquares);
            }
          } catch (error) {
            console.error('Error calculating dests:', error);
          }
        }
      }
    }
    
    return dests;
  }, [gameStatus]);

  // Initialize/Update chessground
  const updateBoard = useCallback(() => {
    if (!boardRef.current || !playerColorRef.current) return;

    const boardConfig = {
      fen: gameRef.current?.fen() || 'start',
      orientation: playerColorRef.current,
      coordinates: false,
      viewOnly: false,
      highlight: { lastMove: true, check: true },
      animation: { enabled: true, duration: 200 },
      movable: {
        free: false,
        color: gameStatus === 'playing' && isMyTurn ? playerColorRef.current : undefined,
        dests: calculateDests(),
        showDests: true,
        events: {
          after: handleMove
        }
      },
      draggable: {
        enabled: true,
        showGhost: true,
        distance: 3
      }
    };

    if (!cgRef.current) {
      cgRef.current = CG(boardRef.current, boardConfig);
      console.log('✅ Chessground initialized');
    } else {
      cgRef.current.set(boardConfig);
    }
  }, [gameStatus, isMyTurn, calculateDests]);

  // Update board when game starts or turn changes
  useEffect(() => {
    if (gameStatus === 'playing' && playerColor) {
      updateBoard();
    }
  }, [gameStatus, playerColor, updateBoard]);

  const handleMove = useCallback(async (from: Key, to: Key) => {
    if (!connection || !roomId || gameStatus !== 'playing' || !isMyTurn) {
      showMessage('⏳ نوبت شما نیست یا بازی فعال نیست', 2000);
      return false;
    }

    try {
      console.log('♟️ Making move:', from, to);
      
      // Validate move locally first
      if (gameRef.current) {
        const move = gameRef.current.move({ from: from as Square, to: to as Square });
        if (!move) {
          showMessage('❌ حرکت غیرمجاز', 2000);
          return false;
        }
      }

      // Send move to server
      const result = await connection.invoke('MakeMove', roomId, from, to);
      console.log('📤 Move result:', result);
      
      if (result?.Success) {
        return true;
      } else {
        showMessage(result?.Message || '❌ سرور حرکت را رد کرد', 3000);
        return false;
      }
    } catch (error: any) {
      console.error('Error making move:', error);
      showMessage(`❌ خطا: ${error.message}`, 3000);
      return false;
    }
  }, [connection, roomId, gameStatus, isMyTurn, showMessage]);

  const handleSendMessage = useCallback(async () => {
    if (!connection || !roomId || !newMessage.trim()) return;

    try {
      await connection.invoke('SendGameMessage', roomId, newMessage.trim());
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
      showMessage('❌ خطا در ارسال پیام', 3000);
    }
  }, [connection, roomId, newMessage, showMessage]);

  const handleResign = useCallback(async () => {
    if (!connection || !roomId || gameStatus !== 'playing') return;

    if (window.confirm('آیا مطمئنید می‌خواهید تسلیم شوید؟')) {
      await connection.invoke('ResignGame', roomId);
    }
  }, [connection, roomId, gameStatus]);

  const handleOfferDraw = useCallback(async () => {
    if (!connection || !roomId || gameStatus !== 'playing') return;

    await connection.invoke('OfferDraw', roomId);
    showMessage('🤝 پیشنهاد تساوی ارسال شد', 3000);
  }, [connection, roomId, gameStatus, showMessage]);

  const handleTimeout = useCallback(() => {
    if (!isMountedRef.current) return;
    
    setGameStatus('finished');
    setWinner(playerColor === 'white' ? 'black' : 'white');
    showMessage('⏰ زمان شما به پایان رسید!', 5000);
  }, [playerColor, showMessage]);

  const formatTime = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }, []);

  // Loading state
  if (isLoading) {
    return (
      <div className="multiplayer-loading">
        <div className="loading-spinner"></div>
        <p>🎮 در حال اتصال به بازی...</p>
        <p>🔗 اتاق: {roomId}</p>
        <p>👤 در انتظار حریف...</p>
        <button className="back-btn" onClick={onBack} style={{ marginTop: '20px' }}>
          ← بازگشت
        </button>
      </div>
    );
  }

  return (
    <div className="chess-multiplayer" dir="rtl">
      {/* Header */}
      <header className="multiplayer-header">
        <button className="back-btn" onClick={onBack}>
          ← خانه
        </button>
        
        <div className="game-info">
          <div className="room-info">
            🎮 بازی شطرنج
            <span className="room-id">
              شناسه: {roomId ? (roomId.slice(0, 8) + '...') : '...'}
            </span>
          </div>
          <div className={`game-status ${gameStatus}`}>
            {gameStatus === 'waiting' && '⏳ منتظر حریف'}
            {gameStatus === 'playing' && '🎮 در حال بازی'}
            {gameStatus === 'finished' && '🏁 پایان یافته'}
          </div>
        </div>
      </header>

      {/* Players info */}
      <div className="players-info">
        <div className={`player-card ${playerColor === 'white' ? 'me' : 'opponent'}`}>
          <div className="player-color white">⚪</div>
          <div className="player-details">
            <h3>{playerColor === 'white' ? playerName : opponentName}</h3>
            <p>سفید</p>
          </div>
          <div className={`player-timer ${activeTimer === 'me' && playerColor === 'white' ? 'active' : ''} ${myTime < 30 ? 'critical' : ''}`}>
            {formatTime(myTime)}
          </div>
        </div>

        <div className="vs-indicator">🎮</div>

        <div className={`player-card ${playerColor === 'black' ? 'me' : 'opponent'}`}>
          <div className="player-color black">⚫</div>
          <div className="player-details">
            <h3>{playerColor === 'black' ? playerName : opponentName}</h3>
            <p>سیاه</p>
          </div>
          <div className={`player-timer ${activeTimer === 'me' && playerColor === 'black' ? 'active' : ''} ${opponentTime < 30 ? 'critical' : ''}`}>
            {formatTime(opponentTime)}
          </div>
        </div>
      </div>

      {/* Chess board */}
      <div className="chess-board-container">
        <div ref={boardRef} className="multiplayer-board" />
      </div>

      {/* Game status */}
      <div className="game-status-bar">
        <div className="status-item">
          <span>نوبت:</span>
          <strong>{isMyTurn ? 'شما' : opponentName}</strong>
        </div>
        
        <div className="status-item">
          <span>حرکت:</span>
          <strong>{moveCount}</strong>
        </div>
        
        <div className="status-item">
          <span>وضعیت:</span>
          <strong>
            {gameRef.current?.isCheckmate() ? 'کیش مات' :
             gameRef.current?.isStalemate() ? 'پات' :
             gameRef.current?.inCheck() ? 'کیش' :
             'عادی'}
          </strong>
        </div>
      </div>

      {/* Game controls */}
      <div className="game-controls">
        <button 
          className="control-btn flip"
          onClick={() => {
            if (cgRef.current) {
              const newOrientation = cgRef.current.state.orientation === 'white' ? 'black' : 'white';
              cgRef.current.set({ orientation: newOrientation });
            }
          }}
        >
          🔄 چرخش
        </button>
        
        {gameStatus === 'playing' && (
          <>
            <button 
              className="control-btn draw"
              onClick={handleOfferDraw}
            >
              🤝 پیشنهاد تساوی
            </button>
            
            <button 
              className="control-btn resign"
              onClick={handleResign}
            >
              🏳️ تسلیم
            </button>
          </>
        )}
      </div>

      {/* Chat */}
      <div className="game-chat">
        <h4>💬 چت بازی</h4>
        <div className="chat-messages">
          {chatMessages.map((msg, index) => (
            <div 
              key={index} 
              className={`message ${msg.sender === playerName ? 'my-message' : 'opponent-message'}`}
            >
              <div className="message-sender">{msg.sender}</div>
              <div className="message-text">{msg.text}</div>
              <div className="message-time">{msg.time}</div>
            </div>
          ))}
          {chatMessages.length === 0 && (
            <div className="no-messages">
              هیچ پیامی هنوز ارسال نشده است
            </div>
          )}
        </div>
        <div className="chat-input">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="پیام خود را بنویسید..."
            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
          />
          <button onClick={handleSendMessage}>📤</button>
        </div>
      </div>

      {/* Message toast */}
      {message && (
        <div className="message-toast">
          <div className="message-content">{message}</div>
          <button onClick={clearMessage}>✕</button>
        </div>
      )}

      {/* Game result */}
      {gameStatus === 'finished' && (
        <div className="game-result-overlay">
          <div className="result-content">
            <h2>🎮 بازی پایان یافت</h2>
            <p className="result-text">
              {winner === 'draw' ? 'مساوی شد!' :
               winner === playerColor ? 'شما برنده شدید! 🎉' : 
               `${opponentName} برنده شد!`}
            </p>
            <div className="result-actions">
              {onNewGame && (
                <button 
                  className="result-btn new-game"
                  onClick={onNewGame}
                >
                  🆕 بازی جدید
                </button>
              )}
              <button 
                className="result-btn home"
                onClick={onBack}
              >
                🏠 خانه
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}