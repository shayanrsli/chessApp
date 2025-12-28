

// ChessBoard.tsx - نسخه کامل و تصحیح شده
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Chess, Move, type Square } from "chess.js";
import { Chessground as CG } from "chessground";
import type { Api, Key } from "chessground/api";
import type { Config } from "chessground/config";
import "chessground/assets/chessground.base.css";
import "chessground/assets/chessground.brown.css";
import "chessground/assets/chessground.cburnett.css";
import "./ChessBoard.css";
import { StockfishEngine } from "../../components/StockfishEngine/StockfishEngine"


// ========== تعریف ثابت‌ها در ابتدای فایل ==========
const ICONS = {
  queen: "👑",
  rook: "🏰",
  bishop: "♝",
  knight: "♞",
  undo: "↩️",
  flip: "🔄",
  reset: "🆕",
  analyze: "📝",
  edit: "✏️",
  white: "⚪",
  black: "⚫",
  clock: "⏱️",
  increment: "➕",
  time: "⏰",
  surrender: "🏳️",
  checkmate: "♟️",
  stalemate: "🤝",
  victory: "🎉",
  draw: "🤝",
  ai: "🤖",
  human: "👤",
  easy: "😊",
  medium: "😐",
  hard: "😈",
  vsHuman: "👥",
  vsAI: "🤖"
};

const TIME_CONTROLS = {
  "blitz_5|0": { name: "بلیتز 5+0", time: 300, increment: 0 },
  "rapid_10|0": { name: "رپید 10+0", time: 600, increment: 0 },
  "rapid_15|10": { name: "رپید 15+10", time: 900, increment: 10 },
};

const DIFFICULTY_LEVELS = [
  { value: 1, label: "😊 بسیار آسان (سطح 1)", color: "#22c55e" },
  { value: 3, label: "🙂 آسان (سطح 3)", color: "#4ade80" },
  { value: 5, label: "😐 متوسط رو به پایین (سطح 5)", color: "#eab308" },
  { value: 8, label: "🧐 متوسط (سطح 8)", color: "#f59e0b" },
  { value: 12, label: "😠 سخت (سطح 12)", color: "#f97316" },
  { value: 16, label: "😈 بسیار سخت (سطح 16)", color: "#ef4444" },
  { value: 20, label: "🔥 استاد (سطح 20)", color: "#dc2626" }
];

export function ChessBoard() {
  // ========== Refs ==========
  const boardRef = useRef<HTMLDivElement>(null);
  const cgRef = useRef<Api | null>(null);
  const timerRef = useRef<number | null>(null);

  // ========== State اصلی ==========
  const [game] = useState(() => new Chess());
  const [fen, setFen] = useState(game.fen());
  const [lastMove, setLastMove] = useState<[Square, Square] | null>(null);
  const [orientation, setOrientation] = useState<"white" | "black">("white");
  const [moveHistory, setMoveHistory] = useState<Move[]>([]);
  
  // State‌های قبلی
  const [promotion, setPromotion] = useState({ 
    pending: false, 
    from: null as Square | null, 
    to: null as Square | null 
  });
  const [drawMode, setDrawMode] = useState(false);
  const [isBoardEditor, setIsBoardEditor] = useState(false);
  const [premoveEnabled, setPremoveEnabled] = useState(true);
  const [message, setMessage] = useState("");
  const [selectedMoveIndex, setSelectedMoveIndex] = useState<number | null>(null);
  
  // ========== تایمرها ==========
  const [whiteTime, setWhiteTime] = useState(TIME_CONTROLS["blitz_5|0"].time);
  const [blackTime, setBlackTime] = useState(TIME_CONTROLS["blitz_5|0"].time);
  const [increment, setIncrement] = useState(TIME_CONTROLS["blitz_5|0"].increment);
  const [activeTimer, setActiveTimer] = useState<"white" | "black" | null>("white");
  const [gameStarted, setGameStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [winner, setWinner] = useState<"white" | "black" | "draw" | null>(null);
  const [selectedTimeControl, setSelectedTimeControl] = useState<keyof typeof TIME_CONTROLS>("blitz_5|0");
  
  // ========== State‌های جدید برای Stockfish ==========
  const [gameMode, setGameMode] = useState<'pvp' | 'vsAI'>('pvp');
  const [difficulty, setDifficulty] = useState(8);
  const [aiColor, setAiColor] = useState<'white' | 'black'>('black');
  const [isEngineThinking, setIsEngineThinking] = useState(false);
  const [engineMessage, setEngineMessage] = useState('');

  // ========== توابع کمکی ==========
  // نمایش پیام موقت
  const showMessage = useCallback((text: string, duration: number = 3500) => {
    setMessage(text);
    setTimeout(() => setMessage(""), duration);
  }, []);

  // محاسبه حرکات قانونی
  const calculateDests = useCallback((): Map<Square, Square[]> => {
    const dests = new Map<Square, Square[]>();
    
    if (isBoardEditor || gameOver) {
      return dests;
    }

    const turn = game.turn();
    const board = game.board();
    
    board.forEach((row, rowIndex) => {
      if (!row) return;
      
      row.forEach((piece, colIndex) => {
        if (piece && piece.color === turn) {
          const square = `${String.fromCharCode(97 + colIndex)}${8 - rowIndex}` as Square;
          try {
            const moves = game.moves({ 
              square, 
              verbose: true 
            });
            
            if (moves.length > 0) {
              const destSquares = moves.map(m => 
                m.to as Square
              ).filter((dest, index, self) => 
                self.indexOf(dest) === index
              );
              
              dests.set(square, destSquares);
            }
          } catch (error) {
            // خطا را نادیده بگیر
          }
        }
      });
    });
    
    return dests;
  }, [game, isBoardEditor, gameOver]);

  // تبدیل حرکات به فرمت Chessground
  const convertDestsForChessground = useCallback((dests: Map<Square, Square[]>): Map<Key, Key[]> => {
    const newMap = new Map<Key, Key[]>();
    dests.forEach((destinations, source) => {
      newMap.set(source as Key, destinations as Key[]);
    });
    return newMap;
  }, []);

  // تغییر نوبت تایمر (حرفه‌ای)
  const switchTimer = useCallback((previousPlayer: "white" | "black") => {
    // به بازیکنی که حرکت کرده، increment اضافه کن
    if (increment > 0) {
      if (previousPlayer === "white") {
        setWhiteTime(prev => Math.floor(prev + increment));
      } else {
        setBlackTime(prev => Math.floor(prev + increment));
      }
    }
    
    // تایمر رو به بازیکن مقابل بده
    setActiveTimer(previousPlayer === "white" ? "black" : "white");
  }, [increment]);

  // فرمت زمان (با اعشار برای نمایش دقیق)
  const formatTime = useCallback((seconds: number) => {
    const totalSeconds = Math.floor(seconds);
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    const tenths = Math.floor((seconds % 1) * 10);
    
    if (mins > 0) {
      return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    } else {
      return `${secs}.${tenths}`;
    }
  }, []);

  // اتمام زمان
  const handleTimeout = useCallback((player: "white" | "black") => {
    handleGameEnd('timeout', player === "white" ? "black" : "white");
  }, []);

  // ========== مدیریت پایان بازی ==========
  const handleGameEnd = useCallback((resultType: 'checkmate' | 'stalemate' | 'draw' | 'surrender' | 'timeout', winner?: 'white' | 'black') => {
    setGameOver(true);
    setActiveTimer(null);
    
    let message = "";
    
    switch (resultType) {
      case 'checkmate':
        const winnerSide = winner === 'white' ? 'سفید' : 'سیاه';
        const loserSide = winner === 'white' ? 'سیاه' : 'سفید';
        setWinner(winner ?? null);

        message = `${ICONS.victory} کیش و مات! ${winnerSide} برنده شد!\n\n`;
        message += `🧠 ${loserSide} مات شد و هیچ راه فراری نداشت!\n`;
        message += `👑 تبریک به ${winnerSide}! بازی استثنایی بود!`;
        break;
        
      case 'stalemate':
        setWinner('draw');
        const stalemateSide = game.turn() === 'w' ? 'سفید' : 'سیاه';
        message = `${ICONS.stalemate} پات! بازی مساوی شد!\n\n`;
        message += `🏆 ${stalemateSide} هیچ حرکت قانونی ندارد اما کیش نیست!\n`;
        message += `⚖️ نتیجه: تساوی فنی - مهارت‌های دفاعی عالی!`;
        break;
        
      case 'draw':
        setWinner('draw');
        message = `${ICONS.draw} بازی به تساوی پایان یافت!\n\n`;
        message += `📊 دلایل ممکن:\n`;
        message += `• تکرار سه‌باره موقعیت\n`;
        message += `• 50 حرکت بدون پیشرفت\n`;
        message += `• مواد کافی برای کیش و مات نبود\n`;
        message += `• توافق دوطرفه`;
        break;
        
      case 'surrender':
        const surrendered = winner === 'white' ? 'سیاه' : 'سفید';
        const winnerSideSurrender = winner === 'white' ? 'سفید' : 'سیاه';
        setWinner(winner ?? null);

        message = `${ICONS.surrender} ${surrendered} تسلیم شد!\n\n`;
        message += `🎖️ ${winnerSideSurrender} پیروز میدان شد!\n`;
        message += `🙌 شجاعت خودت رو در بازی بعدی نشان بده!\n`;
        message += `💪 هر شکست پلی‌ست برای پیروزی‌های آینده!`;
        break;
        
      case 'timeout':
        const timeoutWinner = winner === 'white' ? 'سفید' : 'سیاه';
        const timeoutLoser = winner === 'white' ? 'سیاه' : 'سفید';
        setWinner(winner ?? null);

        message = `${ICONS.clock} زمان ${timeoutLoser} به پایان رسید!\n\n`;
        message += `⚡ ${timeoutWinner} با اتمام زمان حریف برنده شد!\n`;
        message += `⏱️ مدیریت زمان کلید موفقیت در شطرنج است!\n`;
        message += `📈 در بازی بعدی زمان‌ت رو بهتر مدیریت کن!`;
        break;
    }
    
    showMessage(message, 5000);
    
    // لرزش تخته برای اتمام بازی
    if (boardRef.current) {
      boardRef.current.classList.add('game-end-shake');
      setTimeout(() => {
        boardRef.current?.classList.remove('game-end-shake');
      }, 500);
    }
  }, [game, showMessage]);

  // ========== تابع شروع بازی ==========
  const startGame = useCallback(() => {
    const control = TIME_CONTROLS[selectedTimeControl];
    setWhiteTime(control.time);
    setBlackTime(control.time);
    setIncrement(control.increment);
    setGameStarted(true);
    setGameOver(false);
    setWinner(null);
    
    // تنظیم تایمر فعال
    if (gameMode === 'vsAI' && aiColor === 'black') {
      // اگر AI سیاه است، سفید شروع می‌کند
      setActiveTimer("white");
      showMessage(`🎮 بازی ${control.name} شروع شد!\n⚪ شما (سفید) حرکت می‌کنید\n🤖 AI در سطح ${difficulty}`);
    } else if (gameMode === 'vsAI' && aiColor === 'white') {
      // اگر AI سفید است، AI شروع می‌کند
      setActiveTimer(null); // تایمر غیرفعال تا AI حرکت کند
      showMessage(`🎮 بازی ${control.name} شروع شد!\n🤖 AI (سفید) در حال حرکت...`);
      
      // AI حرکت اول را انجام می‌دهد
      setTimeout(() => {
        setEngineMessage('🤖 AI در حال فکر کردن برای حرکت اول...');
        setIsEngineThinking(true);
      }, 1000);
    } else {
      // حالت PvP
      setActiveTimer("white");
      showMessage(`🎮 بازی ${control.name} شروع شد!\n⚪ سفید حرکت می‌کند`);
    }
  }, [selectedTimeControl, gameMode, aiColor, difficulty, showMessage]);

  // ========== تابع تسلیم ==========
  const handleSurrender = useCallback(() => {
    if (!gameStarted || gameOver) {
      showMessage("❌ بازی در حال انجام نیست!");
      return;
    }
    
    // تایید تسلیم
    if (!window.confirm("آیا مطمئن هستید که می‌خواهید تسلیم شوید؟")) {
      return;
    }
    
    const surrenderingPlayer = game.turn() === 'w' ? 'white' : 'black';
    const winner = surrenderingPlayer === 'white' ? 'black' : 'white';
    
    handleGameEnd('surrender', winner);
  }, [game, gameStarted, gameOver, handleGameEnd, showMessage]);

  // ========== پیشنهاد تساوی ==========
  const handleDrawOffer = useCallback(() => {
    if (!gameStarted || gameOver) {
      showMessage("❌ بازی در حال انجام نیست!");
      return;
    }
    
    const offeringPlayer = game.turn() === 'w' ? 'سفید' : 'سیاه';
    showMessage(`⚖️ ${offeringPlayer} پیشنهاد تساوی داد!\n\nاگر حریف موافق باشد، بازی مساوی می‌شود.`);
    
    // در نسخه تک‌نفره فعلاً خودکار قبول می‌شود
    setTimeout(() => {
      handleGameEnd('draw');
    }, 2000);
  }, [game, gameStarted, gameOver, handleGameEnd, showMessage]);

  // ========== تابع جدید برای مدیریت حرکت AI ==========
  const handleAiMove = useCallback((moveStr: string) => {
    if (gameOver || !gameStarted) return;
    
    try {
      // تبدیل حرکت از فرمت "e2e4" به پارامترهای جدا
      const from = moveStr.substring(0, 2) as Square;
      const to = moveStr.substring(2, 4) as Square;
      
      // بررسی نیاز به ارتقاء
      const piece = game.get(from);
      let promotionPiece: 'queen' | 'rook' | 'bishop' | 'knight' | undefined;
      
      if (piece && piece.type === 'p') {
        const isWhite = piece.color === 'w';
        const promotionRank = isWhite ? 8 : 1;
        const toRank = parseInt(to[1]);
        
        if (toRank === promotionRank) {
          // AI همیشه وزیر را انتخاب می‌کند
          promotionPiece = 'queen';
        }
      }
      
      // انجام حرکت
      const move = game.move({
        from,
        to,
        promotion: promotionPiece === 'queen' ? 'q' : 
                  promotionPiece === 'rook' ? 'r' : 
                  promotionPiece === 'bishop' ? 'b' : 
                  promotionPiece === 'knight' ? 'n' : undefined
      });
      
      if (move) {
        // تغییر نوبت تایمر
        const previousPlayer = game.turn() === 'w' ? 'black' : 'white';
        if (gameMode === 'pvp') {
          switchTimer(previousPlayer);
        }
        
        // به‌روزرسانی state
        setFen(game.fen());
        setLastMove([move.from as Square, move.to as Square]);
        setMoveHistory([...game.history({ verbose: true })]);
        setSelectedMoveIndex(null);
        
        // نمایش پیام
        const moveNumber = Math.ceil(moveHistory.length / 2) + 1;
        const player = gameMode === 'vsAI' && move.color === aiColor[0] ? '🤖 AI' : move.color === 'w' ? '⚪ سفید' : '⚫ سیاه';
        showMessage(`${player} حرکت کرد: ${move.san} (حرکت ${moveNumber})`);
        
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
          return;
        }
        
        // به‌روزرسانی Chessground
        if (cgRef.current) {
          const dests = calculateDests();
          const convertedDests = convertDestsForChessground(dests);
          
          cgRef.current.set({
            fen: game.fen(),
            turnColor: game.turn() === 'w' ? 'white' : 'black',
            check: game.inCheck(),
            lastMove: [move.from as Key, move.to as Key],
            movable: {
              free: isBoardEditor,
              color: isBoardEditor ? 'both' : (game.turn() === 'w' ? 'white' : 'black'),
              dests: convertedDests,
              showDests: !isBoardEditor,
            }
          });
        }
      }
      
      setIsEngineThinking(false);
      setEngineMessage('');
      
    } catch (error) {
      console.error('❌ AI move error:', error);
      setIsEngineThinking(false);
      setEngineMessage('خطا در حرکت AI');
    }
  }, [game, gameOver, gameStarted, gameMode, aiColor, moveHistory, calculateDests, convertDestsForChessground, isBoardEditor, showMessage, switchTimer, handleGameEnd]);

  // ========== تابع اصلی انجام حرکت ==========
  const handleMove = useCallback((from: Square, to: Square, promotionPiece?: 'queen' | 'rook' | 'bishop' | 'knight') => {
    if (gameOver) {
      showMessage("❌ بازی پایان یافته!");
      return false;
    }
    
    if (!gameStarted) {
      startGame();
    }

    // بررسی اینکه آیا نوبت کاربر است (در حالت vsAI)
    if (gameMode === 'vsAI') {
      const currentPlayerColor = game.turn() === 'w' ? 'white' : 'black';
      if (currentPlayerColor === aiColor) {
        showMessage("❌ نوبت شما نیست! نوبت AI است.");
        return false;
      }
    }

    // بررسی نیاز به ارتقاء
    const piece = game.get(from);
    if (piece && piece.type === 'p') {
      const isWhite = piece.color === 'w';
      const promotionRank = isWhite ? 8 : 1;
      const toRank = parseInt(to[1]);
      
      if (toRank === promotionRank) {
        setPromotion({
          pending: true,
          from,
          to
        });
        showMessage("📈 سرباز به رتبه آخر رسید! نوع ارتقاء را انتخاب کنید");
        return false;
      }
    }
    
    // تبدیل نوع مهره ارتقاء
    const promotionMap = {
      'queen': 'q',
      'rook': 'r',
      'bishop': 'b',
      'knight': 'n'
    };
    
    // انجام حرکت
    const move = game.move({ 
      from, 
      to, 
      promotion: promotionPiece ? promotionMap[promotionPiece] : 'q' 
    });
    
    if (!move) {
      showMessage("❌ حرکت غیرمجاز است!");
      return false;
    }
    
    // تغییر نوبت تایمر (فقط در حالت PvP)
    if (gameMode === 'pvp') {
      const previousPlayer = game.turn() === 'w' ? 'black' : 'white';
      switchTimer(previousPlayer);
    }
    
    // به‌روزرسانی state
    setFen(game.fen());
    setLastMove([move.from as Square, move.to as Square]);
    setMoveHistory([...game.history({ verbose: true })]);
    setSelectedMoveIndex(null);
    
    // نمایش پیام موفقیت
    showMessage(`✅ حرکت انجام شد: ${move.san}`);
    
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
      const convertedDests = convertDestsForChessground(dests);
      
      cgRef.current.set({
        fen: game.fen(),
        turnColor: game.turn() === 'w' ? 'white' : 'black',
        check: game.inCheck(),
        lastMove: [move.from as Key, move.to as Key],
        movable: {
          free: isBoardEditor,
          color: isBoardEditor ? 'both' : (game.turn() === 'w' ? 'white' : 'black'),
          dests: convertedDests,
          showDests: !isBoardEditor,
        }
      });
      
      cgRef.current.cancelPremove();
    }
    
    return true;
  }, [game, gameOver, gameStarted, gameMode, aiColor, startGame, calculateDests, convertDestsForChessground, isBoardEditor, showMessage, switchTimer, handleGameEnd]);

  // ========== هندلر حرکت از Chessground ==========
  const handleMoveCG = useCallback((orig: Key, dest: Key) => {
    if (promotion.pending) {
      showMessage("⚠️ ابتدا نوع ارتقاء را انتخاب کنید");
      return;
    }
    
    handleMove(orig as Square, dest as Square);
  }, [handleMove, promotion.pending, showMessage]);

  // ========== مدیریت انتخاب ارتقاء ==========
  const handlePromotionChoice = useCallback((piece: 'queen' | 'rook' | 'bishop' | 'knight') => {
    if (!promotion.from || !promotion.to) return;
    
    const move = game.move({
      from: promotion.from,
      to: promotion.to,
      promotion: piece === 'queen' ? 'q' : 
                piece === 'rook' ? 'r' : 
                piece === 'bishop' ? 'b' : 'n'
    });
    
    if (move) {
      // تغییر نوبت تایمر (حرفه‌ای)
      const previousPlayer = game.turn() === 'w' ? 'black' : 'white';
      if (gameMode === 'pvp') {
        switchTimer(previousPlayer);
      }
      
      setFen(game.fen());
      setLastMove([move.from as Square, move.to as Square]);
      setMoveHistory([...game.history({ verbose: true })]);
      setSelectedMoveIndex(null);
      
      showMessage(`🎉 سرباز به ${piece === 'queen' ? 'وزیر' : 
                              piece === 'rook' ? 'رخ' : 
                              piece === 'bishop' ? 'فیل' : 'اسب'} ارتقاء یافت!`);
      
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
      }
      
      if (cgRef.current) {
        const dests = calculateDests();
        const convertedDests = convertDestsForChessground(dests);
        
        cgRef.current.set({
          fen: game.fen(),
          check: game.inCheck(),
          lastMove: [move.from as Key, move.to as Key],
          movable: {
            dests: convertedDests,
            color: game.turn() === 'w' ? 'white' : 'black',
          }
        });
      }
    }
    
    // بستن پنجره ارتقاء
    setPromotion({ pending: false, from: null, to: null });
  }, [promotion, game, calculateDests, convertDestsForChessground, showMessage, switchTimer, handleGameEnd, gameMode]);

  // ========== شروع مجدد بازی ==========
  const handleReset = useCallback(() => {
    game.reset();
    setFen(game.fen());
    setLastMove(null);
    setMoveHistory([]);
    setGameStarted(false);
    setGameOver(false);
    setWinner(null);
    setActiveTimer(null);
    setSelectedMoveIndex(null);
    setIsEngineThinking(false);
    setEngineMessage('');
    
    showMessage("🔄 بازی ریست شد! حالت و سطح بازی را انتخاب کنید.");
    
    if (cgRef.current) {
      cgRef.current.set({ fen: game.fen() });
    }
  }, [game, showMessage]);

  // ========== تنظیمات Chessground ==========
  const chessgroundConfig = useMemo((): Config => {
    const dests = calculateDests();
    const convertedDests = convertDestsForChessground(dests);
    
    return {
      fen: fen,
      orientation: orientation,
      coordinates: true,
      viewOnly: false,
      highlight: { 
        lastMove: true, 
        check: true,
      },
      animation: { 
        enabled: true, 
        duration: 200 
      },
      movable: {
        free: isBoardEditor,
        color: isBoardEditor ? 'both' : (gameOver ? 'none' : (game.turn() === 'w' ? 'white' : 'black')),
        dests: convertedDests,
        showDests: !isBoardEditor,
        events: {
          after: handleMoveCG
        }
      },
      premovable: {
        enabled: premoveEnabled && !isBoardEditor && !gameOver,
        showDests: true,
      },
      draggable: {
        enabled: true,
        showGhost: true,
        deleteOnDropOff: false,
        distance: 3,
      },
      drawable: {
        enabled: drawMode,
        visible: true,
        defaultSnapToValidMove: true,
        brushes: {
          green: { key: 'g', color: '#15781B', opacity: 0.8, lineWidth: 10 },
          red: { key: 'r', color: '#882020', opacity: 0.8, lineWidth: 10 },
          blue: { key: 'b', color: '#003088', opacity: 0.8, lineWidth: 10 },
          yellow: { key: 'y', color: '#E6E600', opacity: 0.8, lineWidth: 10 }
        }
      },
      events: {
        change: () => {
          // برای بهینه‌سازی عملکرد
        }
      }
    };
  }, [fen, orientation, game, isBoardEditor, premoveEnabled, drawMode, gameOver, calculateDests, convertDestsForChessground, handleMoveCG]);

  // ========== useEffect‌ها ==========
  // مقداردهی اولیه Chessground
  useEffect(() => {
    if (!boardRef.current || cgRef.current) return;
    
    cgRef.current = CG(boardRef.current, chessgroundConfig);
    
    return () => {
      if (cgRef.current) {
        cgRef.current.destroy();
        cgRef.current = null;
      }
    };
  }, []);

  // به‌روزرسانی تنظیمات Chessground
  useEffect(() => {
    if (cgRef.current) {
      cgRef.current.set(chessgroundConfig);
    }
  }, [chessgroundConfig]);

  // مدیریت تایمر
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
            handleTimeout("white");
            return 0;
          }
          return Math.max(0, prev - 0.1);
        });
      } else if (activeTimer === "black") {
        setBlackTime(prev => {
          if (prev <= 0.1) {
            handleTimeout("black");
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
  }, [gameStarted, gameOver, activeTimer, handleTimeout]);

  // ========== کامپوننت‌های داخلی ==========
  // پنجره انتخاب ارتقاء
  const PromotionModal = () => {
    if (!promotion.pending) return null;
    
    const pieces = [
      { type: 'queen' as const, label: 'وزیر', emoji: '👑' },
      { type: 'rook' as const, label: 'رخ', emoji: '🏰' },
      { type: 'bishop' as const, label: 'فیل', emoji: '♝' },
      { type: 'knight' as const, label: 'اسب', emoji: '♞' }
    ];
    
    return (
      <div className="promotion-overlay">
        <div className="promotion-modal">
          <div className="promotion-header">
            <h3>🎯 انتخاب ارتقاء</h3>
            <p>سرباز به رتبه آخر رسیده است</p>
          </div>
          <div className="promotion-grid">
            {pieces.map(piece => (
              <button
                key={piece.type}
                className="promotion-option"
                onClick={() => handlePromotionChoice(piece.type)}
              >
                <div className="promotion-emoji">{piece.emoji}</div>
                <div className="promotion-label">{piece.label}</div>
              </button>
            ))}
          </div>
          <button 
            className="promotion-cancel"
            onClick={() => setPromotion({ pending: false, from: null, to: null })}
          >
            لغو
          </button>
        </div>
      </div>
    );
  };

  // کامپوننت تایمر
  const TimerDisplay = () => {
    const isWhiteTurn = game.turn() === 'w';
    
    return (
      <div className="timer-container">
        <div className={`timer-display ${activeTimer === "white" ? "active-turn" : ""}`}>
          <div className="timer-label">
            {ICONS.white} سفید
            {isWhiteTurn && gameStarted && !gameOver && <span className="turn-indicator"> ← نوبت حرکت</span>}
          </div>
          <div className={`timer-value ${whiteTime < 10 ? "time-critical" : whiteTime < 30 ? "time-low" : ""} ${activeTimer === "white" ? "timer-active" : ""}`}>
            {ICONS.clock} {formatTime(whiteTime)}
          </div>
          {increment > 0 && (
            <div className="increment-indicator">
              {ICONS.increment} +{increment} ثانیه
            </div>
          )}
        </div>
        
        <div className="timer-separator">VS</div>
        
        <div className={`timer-display ${activeTimer === "black" ? "active-turn" : ""}`}>
          <div className="timer-label">
            {ICONS.black} سیاه
            {!isWhiteTurn && gameStarted && !gameOver && <span className="turn-indicator"> ← نوبت حرکت</span>}
          </div>
          <div className={`timer-value ${blackTime < 10 ? "time-critical" : blackTime < 30 ? "time-low" : ""} ${activeTimer === "black" ? "timer-active" : ""}`}>
            {ICONS.clock} {formatTime(blackTime)}
          </div>
          {increment > 0 && (
            <div className="increment-indicator">
              {ICONS.increment} +{increment} ثانیه
            </div>
          )}
        </div>
      </div>
    );
  };

  // انتخاب زمان‌بندی
  const TimeControlSelector = () => {
    return (
      <div className="time-control-selector">
        <div className="selector-header">
          <h3>{ICONS.time} انتخاب زمان‌بندی حرفه‌ای</h3>
          <p>مطابق با استاندارد فیده و مسابقات جهانی</p>
        </div>
        
        <div className="time-control-grid">
          {Object.entries(TIME_CONTROLS).map(([key, control]) => (
            <button
              key={key}
              className={`time-control-option ${selectedTimeControl === key ? "selected" : ""} ${gameStarted ? "disabled" : ""}`}
              onClick={() => !gameStarted && setSelectedTimeControl(key as keyof typeof TIME_CONTROLS)}
              disabled={gameStarted}
            >
              <div className="control-name">{control.name}</div>
              <div className="control-time">{control.time / 60} دقیقه</div>
              {control.increment > 0 && (
                <div className="control-increment">+{control.increment} ثانیه</div>
              )}
            </button>
          ))}
        </div>
        
        <div className="time-control-info">
          <div className="info-item">
            <span className="info-label">⏱️ تایم تجمعی:</span>
            <span className="info-value">هر بازیکن مجموعاً {TIME_CONTROLS[selectedTimeControl].time / 60} دقیقه زمان دارد</span>
          </div>
          {TIME_CONTROLS[selectedTimeControl].increment > 0 && (
            <div className="info-item">
              <span className="info-label">{ICONS.increment} اینکرمنت:</span>
              <span className="info-value">پس از هر حرکت {TIME_CONTROLS[selectedTimeControl].increment} ثانیه اضافه می‌شود</span>
            </div>
          )}
          <div className="info-item">
            <span className="info-label">⚡ مدل:</span>
            <span className="info-value">
              {selectedTimeControl.includes('bullet') ? 'بولت (سریع)' :
               selectedTimeControl.includes('blitz') ? 'بلیتز (سریع)' :
               selectedTimeControl.includes('rapid') ? 'رپید (متوسط)' : 'کلاسیک (آرام)'}
            </span>
          </div>
        </div>
      </div>
    );
  };

  // وضعیت بازی
  const GameStatus = () => {
    if (!gameStarted) return null;
    
    let statusText = "";
    let statusEmoji = "📊";
    let statusColor = "normal";
    
    if (gameOver) {
      if (winner === 'draw') {
        statusText = "تساوی";
        statusEmoji = "🤝";
        statusColor = "draw";
      } else {
        statusText = `${winner === 'white' ? 'سفید' : 'سیاه'} برنده شد!`;
        statusEmoji = "🎉";
        statusColor = "victory";
      }
    } else if (game.isCheckmate()) {
      statusText = "کیش و مات!";
      statusEmoji = "♟️";
      statusColor = "checkmate";
    } else if (game.isStalemate()) {
      statusText = "پات!";
      statusEmoji = "🏆";
      statusColor = "stalemate";
    } else if (game.inCheck()) {
      statusText = "کیش!";
      statusEmoji = "⚔️";
      statusColor = "check";
    } else {
      statusText = "در جریان";
      statusEmoji = "📈";
      statusColor = "normal";
    }
    
    return (
      <div className="game-status">
        <div className="status-header">
          <h3>📊 وضعیت بازی</h3>
        </div>
        
        <div className="status-grid">
          <div className="status-item">
            <span className="status-label">🎯 نوبت حرکت:</span>
            <span className={`status-value ${game.turn() === 'w' ? 'white-turn' : 'black-turn'}`}>
              {gameMode === 'vsAI' && game.turn() === (aiColor === 'white' ? 'w' : 'b') ? '🤖 AI' : 
               game.turn() === 'w' ? "⚪ سفید" : "⚫ سیاه"}
            </span>
          </div>
          
          <div className="status-item">
            <span className="status-label">📈 وضعیت:</span>
            <span className={`status-value status-${statusColor}`}>
              {statusEmoji} {statusText}
            </span>
          </div>
          
          <div className="status-item">
            <span className="status-label">📋 تعداد حرکات:</span>
            <span className="status-value">{moveHistory.length}</span>
          </div>
          
          <div className="status-item">
            <span className="status-label">⏱️ تایمر فعال:</span>
            <span className="status-value">
              {activeTimer === 'white' ? '⚪ سفید' : activeTimer === 'black' ? '⚫ سیاه' : '⏸️ توقف'}
            </span>
          </div>
        </div>
      </div>
    );
  };

  // انتخاب‌کننده حالت بازی
  const GameModeSelector = () => (
    <div className="game-mode-selector">
      <div className="selector-header">
        <h3>{ICONS.vsHuman} انتخاب حالت بازی</h3>
        <p>بازی در مقابل دوست یا هوش مصنوعی</p>
      </div>
      
      <div className="mode-buttons">
        <button
          className={`mode-btn ${gameMode === 'pvp' ? 'active' : ''}`}
          onClick={() => setGameMode('pvp')}
          disabled={gameStarted}
        >
          <svg className="icon-human" viewBox="0 0 24 24">
            <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
          </svg>
          بازیکن در مقابل بازیکن
        </button>
        
        <button
          className={`mode-btn ${gameMode === 'vsAI' ? 'active' : ''}`}
          onClick={() => setGameMode('vsAI')}
          disabled={gameStarted}
        >
          <svg className="icon-robot" viewBox="0 0 24 24">
            <path d="M20 9V7c0-1.1-.9-2-2-2h-3c0-1.66-1.34-3-3-3S9 3.34 9 5H6c-1.1 0-2 .9-2 2v2c-1.66 0-3 1.34-3 3s1.34 3 3 3v4c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2v-4c1.66 0 3-1.34 3-3s-1.34-3-3-3zM7.5 11.5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5S9.83 13 9 13s-1.5-.67-1.5-1.5zM16 17H8v-2h8v2zm-1-4c-.83 0-1.5-.67-1.5-1.5S14.17 10 15 10s1.5.67 1.5 1.5S15.83 13 15 13z"/>
          </svg>
          بازی با هوش مصنوعی
        </button>
      </div>
      
      {gameMode === 'vsAI' && (
        <div className="ai-settings">
          <div className="setting-row">
            <label>🎨 رنگ شما:</label>
            <div className="color-buttons">
              <button
                className={`color-btn ${aiColor === 'white' ? 'active' : ''}`}
                onClick={() => setAiColor('white')}
                disabled={gameStarted}
              >
                ⚪ سفید
              </button>
              <button
                className={`color-btn ${aiColor === 'black' ? 'active' : ''}`}
                onClick={() => setAiColor('black')}
                disabled={gameStarted}
              >
                ⚫ سیاه
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // انتخاب‌کننده سطح دشواری
  const DifficultySelector = () => (
    <div className="difficulty-selector">
      <div className="selector-header">
        <h3>{ICONS.ai} سطح دشواری هوش مصنوعی</h3>
        <p>Stockfish Level 1 (آسان) تا 20 (استاد)</p>
      </div>
      
      <div className="difficulty-levels">
        {DIFFICULTY_LEVELS.map(level => (
          <button
            key={level.value}
            className={`difficulty-btn ${
              difficulty === level.value ? 'active' : ''
            } ${
              level.value <= 3 ? 'easy' :
              level.value <= 8 ? 'medium' : 'hard'
            }`}
            onClick={() => setDifficulty(level.value)}
            disabled={gameStarted}
            style={{ borderColor: level.color }}
          >
            <div className="difficulty-label">
              {level.value <= 3 ? ICONS.easy :
               level.value <= 8 ? ICONS.medium : ICONS.hard}
               سطح {level.value}
            </div>
            <div className="difficulty-desc">
              {level.value === 1 && 'مبتدی'}
              {level.value === 3 && 'آسان'}
              {level.value === 5 && 'متوسط پایین'}
              {level.value === 8 && 'متوسط'}
              {level.value === 12 && 'سخت'}
              {level.value === 16 && 'خیلی سخت'}
              {level.value === 20 && 'استاد'}
            </div>
          </button>
        ))}
      </div>
      
      <div className="difficulty-info">
        <p>
          <strong>💡 نکته:</strong> سطح بالاتر = تفکر عمیق‌تر و حرکات قوی‌تر
        </p>
        <p style={{ fontSize: '0.9rem', opacity: 0.8 }}>
          <strong>سطح {difficulty}:</strong>
          {difficulty <= 3 && ' مناسب برای مبتدیان و یادگیری'}
          {difficulty > 3 && difficulty <= 8 && ' مناسب برای بازیکنان متوسط'}
          {difficulty > 8 && difficulty <= 12 && ' چالش‌برانگیز برای حرفه‌ای‌ها'}
          {difficulty > 12 && ' سطح استادی - فقط برای خبرگان!'}
        </p>
      </div>
    </div>
  );

  // کارت اطلاعات Stockfish
  const StockfishInfoCard = () => {
    if (gameMode !== 'vsAI' || !gameStarted) return null;
    
    const isAiTurn = game.turn() === (aiColor === 'white' ? 'w' : 'b');
    
    return (
      <div className="stockfish-info-card">
        <div className="info-header">
          <span>{ICONS.ai}</span>
          <h3>هوش مصنوعی Stockfish</h3>
        </div>
        
        <div className="info-grid">
          <div className="info-item">
            <span className="info-label">🏆 سطح دشواری</span>
            <span className="info-value">
              {difficulty <= 3 ? '😊 مبتدی' :
               difficulty <= 8 ? '😐 متوسط' :
               difficulty <= 12 ? '😠 پیشرفته' : '🔥 استاد'} (سطح {difficulty})
            </span>
          </div>
          
          <div className="info-item">
            <span className="info-label">🎨 رنگ AI</span>
            <span className="info-value">
              {aiColor === 'white' ? '⚪ سفید' : '⚫ سیاه'}
            </span>
          </div>
          
          <div className="info-item">
            <span className="info-label">🤖 وضعیت AI</span>
            <span className="info-value">
              {isEngineThinking ? '🔍 در حال فکر کردن...' :
               isAiTurn ? '⏳ منتظر حرکت AI' : '✅ منتظر حرکت شما'}
            </span>
          </div>
          
          <div className="info-item">
            <span className="info-label">⚡ قدرت تخمینی</span>
            <span className="info-value">
              {difficulty * 50} واحد الوریت
            </span>
          </div>
        </div>
        
        {engineMessage && (
          <div className="engine-message">
            {engineMessage}
          </div>
        )}
      </div>
    );
  };

  // ========== رندر نهایی ==========
  return (
    <div className="telegram-chess-app">
      {/* پیام موقت */}
      {message && (
        <div className="message-toast">
          <div className="message-content">{message}</div>
        </div>
      )}
      
      {/* مودال ارتقاء */}
      <PromotionModal />
      
      {/* موتور Stockfish */}
      {gameMode === 'vsAI' && gameStarted && !gameOver && (
        <StockfishEngine
          level={difficulty}
          fen={fen}
          onMove={handleAiMove}
          isEngineTurn={game.turn() === (aiColor === 'white' ? 'w' : 'b')}
          isGameActive={!gameOver && gameStarted}
        />
      )}
      
      {/* نمایش تایمر */}
      <TimerDisplay />
      
      {/* انتخاب حالت بازی */}
      <GameModeSelector />
      
      {/* انتخاب سطح دشواری (فقط در حالت AI) */}
      {gameMode === 'vsAI' && <DifficultySelector />}
      
      {/* کارت اطلاعات Stockfish */}
      <StockfishInfoCard />
      
      {/* انتخاب زمان‌بندی */}
      {!gameStarted && <TimeControlSelector />}
      
      {/* تخته شطرنج */}
      <div className="chess-board-container">
        <div 
          ref={boardRef} 
          className="chess-board"
          style={{ 
            width: "100%",
            maxWidth: "400px",
            height: "400px",
            margin: "0 auto",
            borderRadius: "12px",
            boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
            overflow: "hidden"
          }} 
        />
      </div>
      
      {/* کنترل‌های بازی */}
      <div className="game-controls">
        {!gameStarted ? (
          <button className="control-btn start-game" onClick={startGame}>
            ▶️ شروع بازی
          </button>
        ) : (
          <>
            {!gameOver && (
              <>
                <button className="control-btn surrender-game" onClick={handleSurrender}>
                  {ICONS.surrender} تسلیم
                </button>
                
                <button className="control-btn draw-game" onClick={handleDrawOffer}>
                  {ICONS.draw} پیشنهاد تساوی
                </button>
                
                {gameMode === 'pvp' && (
                  <>
                    <button className="control-btn pause-game" onClick={() => setActiveTimer(null)}>
                      ⏸️ توقف بازی
                    </button>
                    
                    <button className="control-btn resume-game" onClick={() => setActiveTimer(game.turn() === 'w' ? 'white' : 'black')}>
                      ▶️ ادامه بازی
                    </button>
                  </>
                )}
              </>
            )}
          </>
        )}
        
        <button className="control-btn reset-game" onClick={handleReset}>
          {ICONS.reset} بازی جدید
        </button>
        
        <button className="control-btn flip-board" onClick={() => setOrientation(prev => prev === "white" ? "black" : "white")}>
          {ICONS.flip} چرخش تخته
        </button>
      </div>
      
      {/* وضعیت بازی */}
      <GameStatus />
      
      {/* نتیجه بازی */}
      {gameOver && winner && (
        <div className={`game-result ${winner === 'draw' ? 'draw' : 'win'}`}>
          <div className="result-content">
            <h3>
              {winner === 'draw' ? '🤝 بازی مساوی شد!' :
               gameMode === 'vsAI' && winner === (aiColor === 'white' ? 'black' : 'white') ?
               '🎉 شما برنده شدید!' : '🎉 AI برنده شد!'}
            </h3>
            <div className="result-details">
              <p>
                {game.isCheckmate() ? 'با کیش و مات' :
                 game.isStalemate() ? 'با پات' :
                 game.isDraw() ? 'با شرایط تساوی' : 'با اتمام زمان'}
              </p>
              <p className="result-message">
                {gameMode === 'vsAI' && winner === (aiColor === 'white' ? 'black' : 'white') ?
                 'تبریک! شما از AI پیروز شدید!' :
                 gameMode === 'vsAI' ? 'دفعه بعد بهتر بازی کنید!' :
                 'بازی عالی بود!'}
              </p>
            </div>
            <div className="result-actions">
              <button className="result-btn" onClick={handleReset}>
                🔄 بازی جدید
              </button>
              <button className="result-btn share" onClick={() => {
                const resultText = gameMode === 'vsAI' ?
                  `من ${winner === (aiColor === 'white' ? 'black' : 'white') ? 'برنده' : 'بازنده'} بازی با Stockfish (سطح ${difficulty}) شدم! ♟️` :
                  `من در بازی شطرنج ${winner === 'draw' ? 'مساوی' : 'برنده'} شدم! ♟️`;
                navigator.clipboard.writeText(resultText);
                showMessage("📋 نتیجه بازی کپی شد!");
              }}>
                📋 اشتراک‌گذاری
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="app-footer">
        <p className="footer-text">
          ♟️ طراحی شده برای مینی‌اپ تلگرام | 
          <span className="footer-highlight"> با قابلیت بازی با Stockfish</span>
        </p>
        <p className="footer-subtext">
          {gameMode === 'vsAI' ? 
           `سطح فعلی: ${difficulty} (${difficulty <= 3 ? 'آسان' : difficulty <= 8 ? 'متوسط' : 'سخت'})` :
           'حالت: بازیکن در مقابل بازیکن'}
        </p>
      </div>
    </div>
  );
}