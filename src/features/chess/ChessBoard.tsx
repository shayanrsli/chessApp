// ChessBoard.tsx - کاملاً بهینه شده
import { useState, useEffect, useRef, useCallback } from "react";
import { Chess, type Square } from "chess.js";
import { Chessground as CG } from "chessground";
import type { Api, Key } from "chessground/api";
import "chessground/assets/chessground.base.css";
import "chessground/assets/chessground.brown.css";
import "chessground/assets/chessground.cburnett.css";
import "./ChessBoard.css";

// ========== تعریف ثابت‌ها ==========
const TIME_CONTROLS = [
  { id: "blitz_5|0", name: "بلیتز 5+0", time: 5 * 60, increment: 0 },
  { id: "rapid_10|0", name: "رپید 10+0", time: 10 * 60, increment: 0 },
  { id: "rapid_15|10", name: "رپید 15+10", time: 15 * 60, increment: 10 },
];

const DIFFICULTY_LEVELS = [
  { value: 1, label: "😊 مبتدی", thinkTime: 500 },
  { value: 3, label: "🙂 آسان", thinkTime: 800 },
  { value: 5, label: "😐 متوسط", thinkTime: 1200 },
  { value: 8, label: "🧐 پیشرفته", thinkTime: 1500 },
  { value: 12, label: "😠 حرفه‌ای", thinkTime: 2000 },
  { value: 16, label: "😈 نخبه", thinkTime: 2500 },
  { value: 20, label: "🔥 استاد", thinkTime: 3000 }
];

type GameStage = 'color_selection' | 'time_control' | 'difficulty' | 'game';

// ========== الگوریتم AI ساده و سریع ==========
const getSimpleAiMove = (game: Chess, difficulty: number): string | null => {
  const moves = game.moves();
  if (moves.length === 0) return null;
  
  // ارزیابی ساده مهره‌ها
  const pieceValues = { 'p': 1, 'n': 3, 'b': 3, 'r': 5, 'q': 9, 'k': 100 };
  
  let bestMove = moves[0];
  let bestScore = -Infinity;
  
  // برای سطوح پایین: حرکت تصادفی
  if (difficulty <= 3) {
    return moves[Math.floor(Math.random() * moves.length)];
  }
  
  // برای سطوح متوسط: ارزیابی ساده
  for (const move of moves) {
    const gameCopy = new Chess(game.fen());
    const moveResult = gameCopy.move(move);
    if (!moveResult) continue;
    
    let score = 0;
    
    // 1. ارزش مهره‌ها
    const board = gameCopy.board();
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = board[row][col];
        if (piece) {
          const value = pieceValues[piece.type];
          score += piece.color === 'w' ? value : -value;
        }
      }
    }
    
    // 2. پاداش کیش
    if (gameCopy.inCheck()) {
      score += gameCopy.turn() === 'w' ? -10 : 10;
    }
    
    // 3. پاداش حرکت مهره‌های بزرگ (برای سطوح بالا)
    if (difficulty >= 12) {
      if (move.includes('Q')) score += 5;
      if (move.includes('R')) score += 3;
      if (move.includes('B') || move.includes('N')) score += 2;
    }
    
    // 4. پاداش حمله (برای سطوح بالا)
    if (difficulty >= 8 && move.includes('x')) {
      const captured = move.split('x')[1];
      if (captured && captured.length >= 2) {
        const piece = gameCopy.get(captured as Square);
        if (piece) {
          score += pieceValues[piece.type] * 2;
        }
      }
    }
    
    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
  }
  
  return bestMove;
};

// ========== کامپوننت اصلی ==========
export function ChessBoard({ mode = 'bot', onBack }: ChessBoardProps) {
  // ========== Refs ==========
  const boardRef = useRef<HTMLDivElement>(null);
  const cgRef = useRef<Api | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const gameRef = useRef<Chess | null>(null);
  const aiTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // ========== State ==========
  const [gameStage, setGameStage] = useState<GameStage>('color_selection');
  const [playerColor, setPlayerColor] = useState<'white' | 'black'>('white');
  const [selectedTimeControl, setSelectedTimeControl] = useState(TIME_CONTROLS[0]);
  const [difficulty, setDifficulty] = useState(8);
  const [fen, setFen] = useState('start');
  const [orientation, setOrientation] = useState<'white' | 'black'>('white');
  
  // تایمرها
  const [whiteTime, setWhiteTime] = useState(0);
  const [blackTime, setBlackTime] = useState(0);
  const [activeTimer, setActiveTimer] = useState<'white' | 'black' | null>(null);
  
  // وضعیت بازی
  const [gameStarted, setGameStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [winner, setWinner] = useState<'white' | 'black' | 'draw' | null>(null);
  const [message, setMessage] = useState("");
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [moveCount, setMoveCount] = useState(0);

  // ========== Initialize Game ==========
  useEffect(() => {
    if (!gameRef.current) {
      gameRef.current = new Chess();
      setFen(gameRef.current.fen());
    }
  }, []);

  // ========== توابع کمکی ==========
  const showMessage = useCallback((text: string, duration: number = 3000) => {
    setMessage(text);
    setTimeout(() => setMessage(""), duration);
  }, []);

  const formatTime = useCallback((seconds: number) => {
    const totalSeconds = Math.floor(seconds);
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }, []);

  const calculateDests = useCallback(() => {
    if (!gameRef.current || gameOver) return new Map<Key, Key[]>();
    
    const game = gameRef.current;
    const dests = new Map<Key, Key[]>();
    const turn = game.turn();
    const board = game.board();
    
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = board[row][col];
        if (piece && piece.color === turn) {
          const square = `${String.fromCharCode(97 + col)}${8 - row}` as Key;
          try {
            const moves = game.moves({ square: square as Square, verbose: true });
            if (moves.length > 0) {
              const destSquares = moves.map(m => m.to as Key)
                .filter((dest, index, self) => self.indexOf(dest) === index);
              dests.set(square, destSquares);
            }
          } catch {
            // ignore
          }
        }
      }
    }
    
    return dests;
  }, [gameOver]);

  const switchTimer = useCallback((previousPlayer: "white" | "black") => {
    if (selectedTimeControl.increment > 0) {
      if (previousPlayer === "white") {
        setWhiteTime(prev => Math.floor(prev + selectedTimeControl.increment));
      } else {
        setBlackTime(prev => Math.floor(prev + selectedTimeControl.increment));
      }
    }
    setActiveTimer(previousPlayer === "white" ? "black" : "white");
  }, [selectedTimeControl]);

  const handleGameEnd = useCallback((resultType: 'checkmate' | 'stalemate' | 'draw' | 'surrender' | 'timeout', winner?: 'white' | 'black') => {
    setGameOver(true);
    setActiveTimer(null);
    
    switch (resultType) {
      case 'checkmate':
        setWinner(winner || null);
        showMessage(`🎉 ${winner === 'white' ? 'سفید' : 'سیاه'} برنده شد!`, 5000);
        break;
      case 'timeout':
        setWinner(winner || null);
        showMessage(`⏱️ زمان ${winner === 'white' ? 'سیاه' : 'سفید'} به پایان رسید!`, 5000);
        break;
      case 'draw':
        setWinner('draw');
        showMessage("🤝 بازی مساوی شد!", 5000);
        break;
      case 'surrender':
        setWinner(winner || null);
        showMessage(`🏳️ ${winner === 'white' ? 'سیاه' : 'سفید'} تسلیم شد!`, 5000);
        break;
    }
  }, [showMessage]);

  // ========== حرکت AI سریع و غیر-بلاکینگ ==========
  const handleAiMove = useCallback(() => {
    if (!gameRef.current || gameOver || !gameStarted || !isAiThinking) return;
    
    try {
      const game = gameRef.current;
      
      // سریع و بدون بلاک کردن UI
      const bestMove = getSimpleAiMove(game, difficulty);
      
      if (!bestMove) {
        setIsAiThinking(false);
        return;
      }

      const move = game.move(bestMove);
      if (!move) {
        setIsAiThinking(false);
        return;
      }

      // به‌روزرسانی FEN
      setFen(game.fen());
      setMoveCount(prev => prev + 1);
      
      // تغییر تایمر
      const previousPlayer = 'white';
      switchTimer(previousPlayer);

      // بررسی پایان بازی
      if (game.isGameOver()) {
        if (game.isCheckmate()) {
          const winner = game.turn() === 'w' ? 'black' : 'white';
          handleGameEnd('checkmate', winner);
        } else if (game.isStalemate()) {
          handleGameEnd('stalemate');
        } else if (game.isDraw()) {
          handleGameEnd('draw');
        }
        setIsAiThinking(false);
        return;
      }

      // به‌روزرسانی Chessground
      if (cgRef.current) {
        const dests = calculateDests();
        
        cgRef.current.set({
          fen: game.fen(),
          turnColor: game.turn() === 'w' ? 'white' : 'black',
          check: game.inCheck(),
          lastMove: [move.from as Key, move.to as Key],
          movable: {
            free: false,
            color: game.turn() === 'w' ? 'white' : 'black',
            dests,
            showDests: true,
          }
        });
      }

      showMessage(`🤖 AI (سطح ${difficulty}) حرکت کرد: ${move.san}`);
      setIsAiThinking(false);

    } catch (error) {
      console.error('AI move error:', error);
      setIsAiThinking(false);
    }
  }, [gameOver, gameStarted, isAiThinking, difficulty, calculateDests, switchTimer, handleGameEnd, showMessage]);

  // ========== حرکت کاربر ==========
  const handleUserMove = useCallback((from: Key, to: Key) => {
    if (!gameRef.current || gameOver) {
      showMessage("❌ بازی پایان یافته!");
      return false;
    }

    const game = gameRef.current;
    
    // بررسی نوبت کاربر
    if (mode === 'bot') {
      const userTurn = playerColor === 'white' ? game.turn() === 'w' : game.turn() === 'b';
      if (!userTurn) {
        showMessage("❌ نوبت AI است!");
        return false;
      }
    }

    const move = game.move({ 
      from: from as Square, 
      to: to as Square 
    });
    
    if (!move) {
      showMessage("❌ حرکت غیرمجاز است!");
      return false;
    }

    // به‌روزرسانی FEN
    setFen(game.fen());
    setMoveCount(prev => prev + 1);
    
    // تغییر تایمر
    const previousPlayer = game.turn() === 'w' ? 'black' : 'white';
    switchTimer(previousPlayer);

    // بررسی پایان بازی
    if (game.isGameOver()) {
      if (game.isCheckmate()) {
        const winner = game.turn() === 'w' ? 'black' : 'white';
        handleGameEnd('checkmate', winner);
      } else if (game.isStalemate()) {
        handleGameEnd('stalemate');
      } else if (game.isDraw()) {
        handleGameEnd('draw');
      }
      return true;
    }

    // به‌روزرسانی Chessground
    if (cgRef.current) {
      const dests = calculateDests();
      
      cgRef.current.set({
        fen: game.fen(),
        turnColor: game.turn() === 'w' ? 'white' : 'black',
        check: game.inCheck(),
        lastMove: [from, to],
        movable: {
          free: false,
          color: game.turn() === 'w' ? 'white' : 'black',
          dests,
          showDests: true,
        }
      });
    }

    // اگر نوبت AI است، AI را فعال کن
    if (mode === 'bot') {
      const aiTurn = playerColor === 'white' ? game.turn() === 'b' : game.turn() === 'w';
      if (aiTurn) {
        setTimeout(() => setIsAiThinking(true), 100);
      }
    }

    showMessage(`✅ حرکت انجام شد: ${move.san}`);
    return true;
  }, [gameOver, mode, playerColor, calculateDests, switchTimer, handleGameEnd, showMessage]);

  // ========== شروع بازی ==========
  const startGame = useCallback(() => {
    if (!gameRef.current) return;

    // ریست بازی
    gameRef.current.reset();
    setFen(gameRef.current.fen());
    
    // تنظیم تایمرها
    setWhiteTime(selectedTimeControl.time);
    setBlackTime(selectedTimeControl.time);
    setGameStarted(true);
    setGameOver(false);
    setWinner(null);
    setGameStage('game');
    setIsAiThinking(false);
    setMoveCount(0);
    
    // تنظیم تخته بر اساس رنگ کاربر
    if (playerColor === 'white') {
      setActiveTimer("white");
      setOrientation("white");
      showMessage(`🎮 بازی شروع شد! شما سفید هستید. ${selectedTimeControl.name} - AI سطح ${difficulty}`);
    } else {
      setActiveTimer("black");
      setOrientation("black");
      showMessage(`🎮 بازی شروع شد! شما سیاه هستید. ${selectedTimeControl.name} - AI سطح ${difficulty}`);
      // اگر کاربر سیاه است، AI شروع می‌کند
      if (mode === 'bot') {
        setTimeout(() => setIsAiThinking(true), 500);
      }
    }
    
    // به‌روزرسانی Chessground
    if (cgRef.current && boardRef.current) {
      const dests = calculateDests();
      
      cgRef.current.set({
        fen: gameRef.current.fen(),
        orientation: playerColor === 'white' ? 'white' : 'black',
        turnColor: 'white',
        movable: {
          free: false,
          color: playerColor === 'white' ? 'white' : 'black',
          dests,
          showDests: true,
        }
      });
    }
  }, [selectedTimeControl, playerColor, mode, showMessage, calculateDests, difficulty]);

  // ========== Chessground Lifecycle ==========
  useEffect(() => {
    if (gameStage !== 'game') return;
    if (!boardRef.current) return;
    if (!gameRef.current) return;

    const dests = calculateDests();
    
    if (!cgRef.current) {
      cgRef.current = CG(boardRef.current, {
        fen: gameRef.current.fen(),
        orientation,
        coordinates: false, // برای موبایل بهتره مخفی باشه
        viewOnly: false,
        highlight: { lastMove: true, check: true },
        animation: { enabled: true, duration: 200 },
        movable: {
          free: false,
          color: playerColor === 'white' ? 'white' : 'black',
          dests,
          showDests: true,
          events: {
            after: handleUserMove
          }
        },
        draggable: { 
          enabled: true, 
          showGhost: true, 
          distance: 3,
          magnified: false 
        },
      });
    } else {
      cgRef.current.set({
        fen: gameRef.current.fen(),
        orientation,
        movable: {
          free: false,
          color: playerColor === 'white' ? 'white' : 'black',
          dests,
          showDests: true,
        }
      });
    }

    return () => {
      if (gameStage !== 'game' && cgRef.current) {
        cgRef.current.destroy();
        cgRef.current = null;
      }
    };
  }, [gameStage, orientation, playerColor, calculateDests, handleUserMove]);

  useEffect(() => {
    if (gameStage !== 'game') return;
    if (!cgRef.current) return;
    
    cgRef.current.set({ fen });
  }, [fen, gameStage]);

  // ========== مدیریت تایمر ==========
  useEffect(() => {
    if (!gameStarted || gameOver || !activeTimer) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    timerRef.current = setInterval(() => {
      if (activeTimer === "white") {
        setWhiteTime(prev => {
          if (prev <= 0.1) {
            handleGameEnd('timeout', 'black');
            return 0;
          }
          return Math.max(0, prev - 0.1);
        });
      } else if (activeTimer === "black") {
        setBlackTime(prev => {
          if (prev <= 0.1) {
            handleGameEnd('timeout', 'white');
            return 0;
          }
          return Math.max(0, prev - 0.1);
        });
      }
    }, 100);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [gameStarted, gameOver, activeTimer, handleGameEnd]);

  // ========== AI Timer ==========
  useEffect(() => {
    if (mode === 'bot' && isAiThinking && !gameOver && gameStarted) {
      const level = DIFFICULTY_LEVELS.find(l => l.value === difficulty);
      const thinkTime = level?.thinkTime || 1000;
      
      if (aiTimeoutRef.current) {
        clearTimeout(aiTimeoutRef.current);
      }
      
      // نشان دادن وضعیت فکر کردن
      setTimeout(() => {
        handleAiMove();
      }, thinkTime);

      return () => {
        if (aiTimeoutRef.current) {
          clearTimeout(aiTimeoutRef.current);
        }
      };
    }
  }, [mode, isAiThinking, gameOver, gameStarted, difficulty, handleAiMove]);

  // ========== Game State ==========
  const currentTurn = gameRef.current?.turn() === 'w' ? 'white' : 'black';
  const inCheck = gameRef.current?.inCheck() || false;
  const isCheckmate = gameRef.current?.isCheckmate() || false;
  const isStalemate = gameRef.current?.isStalemate() || false;
  const isDraw = gameRef.current?.isDraw() || false;

  // ========== Handlers ==========
  const handleColorSelect = (color: 'white' | 'black') => {
    setPlayerColor(color);
  };

  const handleTimeControlSelect = (control: typeof TIME_CONTROLS[0]) => {
    setSelectedTimeControl(control);
  };

  const handleDifficultySelect = (level: number) => {
    setDifficulty(level);
  };

  const handleNextStage = () => {
    if (gameStage === 'color_selection') {
      setGameStage('time_control');
    } else if (gameStage === 'time_control') {
      if (mode === 'bot') {
        setGameStage('difficulty');
      } else {
        startGame();
      }
    }
  };

  const handleBackStage = () => {
    if (gameStage === 'time_control') {
      setGameStage('color_selection');
    } else if (gameStage === 'difficulty') {
      setGameStage('time_control');
    }
  };

  const handleSurrender = () => {
    if (!gameStarted || gameOver) return;
    
    if (window.confirm("آیا مطمئنید می‌خواهید تسلیم شوید؟")) {
      handleGameEnd('surrender', playerColor === 'white' ? 'black' : 'white');
    }
  };

  const handleNewGame = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (aiTimeoutRef.current) clearTimeout(aiTimeoutRef.current);
    
    setGameStage('color_selection');
    setGameStarted(false);
    setGameOver(false);
    setWinner(null);
    setActiveTimer(null);
    setWhiteTime(0);
    setBlackTime(0);
    setIsAiThinking(false);
    setMoveCount(0);
  };

  // ========== رندر Stageها ==========
  const renderStage = () => {
    switch (gameStage) {
      case 'color_selection':
        return (
          <div className="setup-stage">
            <div className="stage-header">
              <h2>🎨 انتخاب رنگ</h2>
              <p>رنگ خود را انتخاب کنید</p>
            </div>
            
            <div className="color-selection">
              <div 
                className={`color-option ${playerColor === 'white' ? 'selected' : ''}`}
                onClick={() => handleColorSelect('white')}
              >
                <div className="color-preview white">
                  <span className="king-emoji">♔</span>
                </div>
                <div className="color-info">
                  <h3>⚪ سفید</h3>
                  <p>حرکت اول</p>
                  <div className="color-features">
                    <span>ابتکار عمل</span>
                  </div>
                </div>
              </div>
              
              <div 
                className={`color-option ${playerColor === 'black' ? 'selected' : ''}`}
                onClick={() => handleColorSelect('black')}
              >
                <div className="color-preview black">
                  <span className="king-emoji">♚</span>
                </div>
                <div className="color-info">
                  <h3>⚫ سیاه</h3>
                  <p>ضد حمله</p>
                  <div className="color-features">
                    <span>دفاع قوی</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="stage-actions">
              <button className="next-btn" onClick={handleNextStage}>
                ادامه
              </button>
            </div>
          </div>
        );

      case 'time_control':
        return (
          <div className="setup-stage">
            <div className="stage-header">
              <h2>⏱️ زمان بازی</h2>
              <p>مدت زمان را انتخاب کنید</p>
            </div>
            
            <div className="time-control-selection">
              {TIME_CONTROLS.map((control) => (
                <div
                  key={control.id}
                  className={`time-option ${selectedTimeControl.id === control.id ? 'selected' : ''}`}
                  onClick={() => handleTimeControlSelect(control)}
                >
                  <div className="time-option-header">
                    <h3>{control.name}</h3>
                    <span className="time-badge">
                      {control.time / 60} دقیقه
                    </span>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="stage-actions">
              <button className="back-btn" onClick={handleBackStage}>بازگشت</button>
              <button className="next-btn" onClick={handleNextStage}>ادامه</button>
            </div>
          </div>
        );

      case 'difficulty':
        return (
          <div className="setup-stage">
            <div className="stage-header">
              <h2>🤖 سطح AI</h2>
              <p>قدرت ربات را انتخاب کنید</p>
            </div>
            
            <div className="difficulty-selection">
              {DIFFICULTY_LEVELS.map((level) => (
                <div
                  key={level.value}
                  className={`difficulty-option ${difficulty === level.value ? 'selected' : ''}`}
                  onClick={() => handleDifficultySelect(level.value)}
                >
                  <div className="difficulty-header">
                    <h3>{level.label}</h3>
                  </div>
                  <div className="difficulty-description">
                    {level.value === 1 && 'حرکات ساده، مناسب شروع'}
                    {level.value === 3 && 'آموزشی، حرکات منطقی'}
                    {level.value === 5 && 'متوسط، چالش مناسب'}
                    {level.value === 8 && 'پیشرفته، هوشمند'}
                    {level.value === 12 && 'حرفه‌ای، سخت'}
                    {level.value === 16 && 'نخبه، چالش جدی'}
                    {level.value === 20 && 'استاد، برای نخبگان'}
                  </div>
                </div>
              ))}
            </div>
            
            <div className="stage-actions">
              <button className="back-btn" onClick={handleBackStage}>بازگشت</button>
              <button className="start-game-btn" onClick={startGame}>
                🎮 شروع بازی
              </button>
            </div>
          </div>
        );

      case 'game':
        const levelLabel = DIFFICULTY_LEVELS.find(l => l.value === difficulty)?.label || "متوسط";
        
        return (
          <div className="game-stage">
            {/* هدر بازی */}
            <div className="game-header">
              <div className="player-info">
                <div className="player-card you">
                  <div className="player-color-indicator">
                    {playerColor === 'white' ? '⚪' : '⚫'}
                  </div>
                  <div className="player-details">
                    <h4>شما</h4>
                    <p>{playerColor === 'white' ? 'سفید' : 'سیاه'}</p>
                  </div>
                </div>
                
                {/* <div className="vs">🎮</div> */}
                
                <div className="player-card opponent">
                  <div className="player-color-indicator ai-indicator">
                    🤖
                  </div>
                  <div className="player-details">
                    <h4>ربات</h4>
                    <p>{levelLabel}</p>
                  </div>


                </div>

              <div style={{display:"flex",justifyContent:"center"}}>
                                  {onBack && (
                <button className="back-to-home" onClick={onBack}>
                  ← خانه
                </button>
              )}
                  </div>
                  
              </div>
              

            </div>
            
            {/* تایمرها */}
            <div className="timers-container">
              <div className={`timer ${activeTimer === 'white' ? 'active' : ''} ${whiteTime < 30 ? 'critical' : ''}`}>
                <div className="timer-label">
                  ⚪ {playerColor === 'white' ? 'شما' : 'ربات'}
                </div>
                <div className="timer-value">{formatTime(whiteTime)}</div>
              </div>
              
              <div className={`timer ${activeTimer === 'black' ? 'active' : ''} ${blackTime < 30 ? 'critical' : ''}`}>
                <div className="timer-label">
                  ⚫ {playerColor === 'black' ? 'شما' : 'ربات'}
                </div>
                <div className="timer-value">{formatTime(blackTime)}</div>
              </div>
            </div>
            
            {/* تخته شطرنج */}
            <div className="chess-board-container">
              <div ref={boardRef} className="chess-board-wrapper" />
            </div>
            
            {/* وضعیت بازی */}
            <div className="game-status-bar">
              <div className="status-item">
                <span>نوبت:</span>
                <strong>
                  {currentTurn === playerColor ? 'شما' : 'ربات'}
                </strong>
              </div>
              
              <div className="status-item">
                <span>وضعیت:</span>
                <strong>
                  {isCheckmate ? 'کیش مات' :
                   isStalemate ? 'پات' :
                   inCheck ? 'کیش' :
                   'در جریان'}
                </strong>
              </div>
            </div>
            
            {/* کنترل‌های بازی */}
            <div className="game-controls">
              <button className="control-btn flip" onClick={() => setOrientation(prev => prev === "white" ? "black" : "white")}>
                🔄 چرخش
              </button>
              
              {!gameOver && (
                <button className="control-btn surrender" onClick={handleSurrender}>
                  🏳️ تسلیم
                </button>
              )}
              
              {/* <button className="control-btn new-game" onClick={handleNewGame}>
                🆕 جدید
              </button> */}
            </div>
            
            {/* نتیجه بازی */}
            {gameOver && (
              <div className="game-result-overlay">
                <div className="game-result">
                  <h2>
                    {winner === 'draw' ? 'مساوی شد!' :
                     winner === playerColor ? 'شما برنده شدید!' : 
                     'ربات برنده شد!'}
                  </h2>
                  <p>
                    {isCheckmate ? 'با کیش و مات' :
                     isStalemate ? 'با پات' :
                     isDraw ? 'با تساوی' : 'با اتمام زمان'}
                  </p>
                  <div className="result-actions">
                    {/* <button className="result-btn play-again" onClick={handleNewGame}>
                      🔄 بازی مجدد
                    </button> */}
                    {onBack && (
                      <button className="result-btn back-home" onClick={onBack}>
                        ← خانه
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        );
    }
  };

  // ========== رندر نهایی ==========
  return (
    <div className="telegram-chess-app">
      {/* Stage Indicator */}
      {gameStage !== 'game' && (
        <div className="stage-indicator">
          <div className={`stage-step ${gameStage === 'color_selection' ? 'active' : ''}`}>
            <div className="step-number">1</div>
            <div className="step-label">رنگ</div>
          </div>
          <div className={`stage-step ${gameStage === 'time_control' ? 'active' : ''}`}>
            <div className="step-number">2</div>
            <div className="step-label">زمان</div>
          </div>
          {mode === 'bot' && (
            <>
              <div className={`stage-step ${gameStage === 'difficulty' ? 'active' : ''}`}>
                <div className="step-number">3</div>
                <div className="step-label">سطح</div>
              </div>
              <div className={`stage-step ${gameStage === 'game' ? 'active' : ''}`}>
                <div className="step-number">4</div>
                <div className="step-label">بازی</div>
              </div>
            </>
          )}
        </div>
      )}
      
      {/* Message Toast */}
      {message && (
        <div className="message-toast">
          <div className="message-content">{message}</div>
        </div>
      )}
      
      {/* Stage Content */}
      <div className="stage-content">
        {renderStage()}
      </div>
    </div>
  );
}

interface ChessBoardProps {
  mode?: 'friend' | 'bot';
  onBack?: () => void;
} 