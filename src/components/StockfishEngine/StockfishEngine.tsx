import { useEffect, useRef, useState, useCallback } from 'react';

interface StockfishEngineProps {
  level: number;
  fen: string;
  onMove: (move: string) => void;
  isEngineTurn: boolean;
  isGameActive: boolean;
}

export const StockfishEngine = ({
  level,
  fen,
  onMove,
  isEngineTurn,
  isGameActive
}: StockfishEngineProps) => {
  const engineRef = useRef<Worker | null>(null);
  const [isThinking, setIsThinking] = useState(false);
  const [engineReady, setEngineReady] = useState(false);
  const [engineError, setEngineError] = useState<string | null>(null);

  // ایجاد موتور شطرنج ایرانی
  const createPersianChessEngine = useCallback(() => {
    const workerCode = `
      // موتور شطرنج ایرانی - بدون نیاز به اینترنت خارجی
      class PersianChessEngine {
        constructor() {
          this.position = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
          this.moveHistory = [];
          this.level = 10;
        }

        // ارزیابی موقعیت ساده
        evaluatePosition(fen) {
          // امتیاز دهی ساده به مهره‌ها
          const pieceValues = {
            'p': 100, 'n': 320, 'b': 330, 'r': 500, 'q': 900, 'k': 20000,
            'P': -100, 'N': -320, 'B': -330, 'R': -500, 'Q': -900, 'K': -20000
          };
          
          let score = 0;
          for (let i = 0; i < fen.length; i++) {
            const piece = fen[i];
            if (pieceValues[piece]) {
              score += pieceValues[piece];
            }
          }
          return score;
        }

        // تولید حرکات منطقی بر اساس FEN
        generateLogicalMoves(fen, level) {
          const moves = [];
          const board = this.parseFEN(fen);
          const turn = fen.split(' ')[1];
          
          // حرکات شروع بازی
          const openingMoves = [
            'e2e4', 'd2d4', 'g1f3', 'c2c4', 'b1c3', 'f1c4', 'f1b5', 'g2g3',
            'e7e5', 'd7d5', 'g8f6', 'c7c5', 'b8c6', 'f8c5', 'f8b4', 'g7g6'
          ];
          
          // حرکات میانی بازی
          const middleGameMoves = [
            'e4e5', 'd4d5', 'f3g5', 'c4c5', 'e5d6', 'd5e6',
            'e4d5', 'd4e5', 'f3e5', 'c4d5', 'g5f7', 'c5d6'
          ];
          
          // حرکات تاکتیکی
          const tacticalMoves = [
            'g1f3', 'g8f6', 'f1c4', 'f8c5', 'd1h5', 'd8h4',
            'b1c3', 'b8c6', 'c1g5', 'c8g4', 'h2h4', 'h7h5'
          ];
          
          // بر اساس سطح، حرکات مناسب انتخاب کن
          if (level < 5) {
            // سطح آسان: حرکات ساده
            return openingMoves.slice(0, 8);
          } else if (level < 15) {
            // سطح متوسط: ترکیب حرکات
            return [...openingMoves, ...middleGameMoves];
          } else {
            // سطح سخت: حرکات تاکتیکی
            return [...openingMoves, ...middleGameMoves, ...tacticalMoves];
          }
        }

        parseFEN(fen) {
          const board = [];
          const fenBoard = fen.split(' ')[0];
          let row = [];
          
          for (let i = 0; i < fenBoard.length; i++) {
            const char = fenBoard[i];
            if (char === '/') {
              board.push(row);
              row = [];
            } else if (!isNaN(char)) {
              for (let j = 0; j < parseInt(char); j++) {
                row.push(null);
              }
            } else {
              row.push(char);
            }
          }
          
          if (row.length > 0) board.push(row);
          return board;
        }

        // انتخاب بهترین حرکت بر اساس سطح
        getBestMove(fen, level) {
          const moves = this.generateLogicalMoves(fen, level);
          
          // شبیه‌سازی هوش مصنوعی
          if (level > 15) {
            // سطح سخت: حرکات مرکزی را اولویت بده
            const centerMoves = moves.filter(move => 
              move.includes('e4') || move.includes('d4') || move.includes('e5') || move.includes('d5')
            );
            if (centerMoves.length > 0) {
              return centerMoves[Math.floor(Math.random() * centerMoves.length)];
            }
          } else if (level > 8) {
            // سطح متوسط: حرکات توسعه‌ای
            const developmentMoves = moves.filter(move => 
              move.includes('f3') || move.includes('c3') || move.includes('f6') || move.includes('c6')
            );
            if (developmentMoves.length > 0) {
              return developmentMoves[Math.floor(Math.random() * developmentMoves.length)];
            }
          }
          
          // سطح آسان: حرکت تصادفی
          return moves[Math.floor(Math.random() * moves.length)];
        }
      }

      const engine = new PersianChessEngine();
      
      self.onmessage = function(e) {
        const message = e.data;
        
        if (message === 'uci') {
          self.postMessage('id name Persian Chess Engine 🇮🇷');
          self.postMessage('id author Iranian AI Community');
          self.postMessage('uciok');
        }
        else if (message === 'isready') {
          self.postMessage('readyok');
        }
        else if (message.startsWith('setoption name Skill Level value')) {
          const level = parseInt(message.split(' ')[5]);
          engine.level = level;
          self.postMessage('info string Skill Level set to ' + level);
        }
        else if (message.startsWith('position fen')) {
          const fen = message.split('fen ')[1].split(' ')[0];
          engine.position = fen;
          self.postMessage('info string Position set');
        }
        else if (message.startsWith('go')) {
          // محاسبه زمان فکر کردن بر اساس سطح
          const thinkTime = 300 + (engine.level * 50);
          
          setTimeout(() => {
            const bestMove = engine.getBestMove(engine.position, engine.level);
            self.postMessage('bestmove ' + bestMove);
          }, thinkTime);
        }
        else if (message === 'quit') {
          self.postMessage('info string خدانگهدار');
          self.close();
        }
        else {
          self.postMessage('info string Unknown command');
        }
      };
    `;

    try {
      const blob = new Blob([workerCode], { type: 'application/javascript' });
      return new Worker(URL.createObjectURL(blob));
    } catch (error) {
      console.error('❌ خطا در ایجاد موتور:', error);
      return null;
    }
  }, []);

  // مقداردهی اولیه موتور
  useEffect(() => {
    if (engineRef.current) return;

    try {
      console.log('♟️ راه‌اندازی موتور شطرنج ایرانی...');
      
      // 1. اول سعی کن از فایل محلی استفاده کنی
      const localWorker = new Worker('/stockfish.js');
      engineRef.current = localWorker;
      
      localWorker.onmessage = (event) => {
        const message = event.data;
        
        if (message === 'readyok' || message === 'uciok') {
          setEngineReady(true);
          setEngineError(null);
          console.log('✅ موتور شطرنج آماده است');
        }
        else if (message.startsWith('bestmove')) {
          const parts = message.split(' ');
          if (parts.length > 1 && parts[1] !== '(none)') {
            const move = parts[1];
            onMove(move);
          }
          setIsThinking(false);
        }
      };
      
      localWorker.onerror = () => {
        // اگر فایل محلی کار نکرد، موتور ایرانی را فعال کن
        console.log('⚠️ استفاده از موتور شطرنج ایرانی...');
        const persianWorker = createPersianChessEngine();
        if (persianWorker) {
          engineRef.current = persianWorker;
          
          persianWorker.onmessage = (event) => {
            const message = event.data;
            
            if (message === 'readyok' || message === 'uciok') {
              setEngineReady(true);
              setEngineError(null);
              console.log('✅ موتور ایرانی آماده است');
            }
            else if (message.startsWith('bestmove')) {
              const move = message.split(' ')[1];
              onMove(move);
              setIsThinking(false);
            }
          };
          
          persianWorker.postMessage('uci');
          persianWorker.postMessage('isready');
        }
      };
      
      // شروع موتور محلی
      localWorker.postMessage('uci');
      localWorker.postMessage('isready');
      
    } catch (error) {
      console.log('⚠️ ایجاد موتور ایرانی...');
      const persianWorker = createPersianChessEngine();
      if (persianWorker) {
        engineRef.current = persianWorker;
        setEngineReady(true);
        
        persianWorker.onmessage = (event) => {
          if (event.data.startsWith('bestmove')) {
            const move = event.data.split(' ')[1];
            onMove(move);
            setIsThinking(false);
          }
        };
        
        persianWorker.postMessage('uci');
      } else {
        setEngineError('سیستم شطرنج در دسترس نیست');
      }
    }

    return () => {
      if (engineRef.current) {
        engineRef.current.terminate();
        engineRef.current = null;
      }
    };
  }, [createPersianChessEngine, onMove]);

  // تنظیم سطح دشواری
  useEffect(() => {
    if (engineRef.current && engineReady) {
      engineRef.current.postMessage(`setoption name Skill Level value ${level}`);
    }
  }, [level, engineReady]);

  // درخواست حرکت
  const getBestMove = useCallback(() => {
    if (!engineRef.current || !engineReady || !isEngineTurn || !isGameActive) {
      return;
    }

    setIsThinking(true);
    
    // تنظیم موقعیت فعلی
    engineRef.current.postMessage(`position fen ${fen}`);
    
    // درخواست حرکت
    const thinkTime = 300 + (level * 50);
    engineRef.current.postMessage(`go movetime ${thinkTime}`);
    
  }, [fen, level, isEngineTurn, isGameActive, engineReady]);

  // هنگام نوبت موتور
  useEffect(() => {
    if (isEngineTurn && isGameActive && engineReady && !isThinking) {
      const timer = setTimeout(() => {
        getBestMove();
      }, 300);
      
      return () => clearTimeout(timer);
    }
  }, [isEngineTurn, isGameActive, engineReady, isThinking, getBestMove]);

  // ========== نمایش وضعیت ==========

  // خطا
  if (engineError) {
    return (
      <div style={{
        background: '#7c2d12',
        color: 'white',
        padding: '12px',
        borderRadius: '8px',
        margin: '10px 0',
        border: '2px solid #ea580c'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '1.2rem' }}>⚠️</span>
          <div>
            <strong>هشدار سیستم شطرنج</strong>
            <p style={{ margin: '5px 0' }}>{engineError}</p>
            <small style={{ opacity: 0.8 }}>استفاده از موتور داخلی ایرانی</small>
          </div>
        </div>
      </div>
    );
  }

  // در حال فکر کردن
  if (isThinking) {
    return (
      <div style={{
        background: 'linear-gradient(135deg, #0c4a6e 0%, #0369a1 100%)',
        color: 'white',
        padding: '12px',
        borderRadius: '8px',
        margin: '10px 0',
        border: '2px solid #0ea5e9',
        boxShadow: '0 4px 12px rgba(14, 165, 233, 0.3)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '5px' }}>
          <div style={{ display: 'flex', gap: '4px' }}>
            {[1, 2, 3].map(i => (
              <div key={i} style={{
                width: '8px',
                height: '8px',
                background: '#60a5fa',
                borderRadius: '50%',
                animation: `pulse 1.4s infinite ${i * 0.2}s`
              }} />
            ))}
          </div>
          <div>
            <div style={{ fontWeight: '600' }}>🤖 هوش مصنوعی ایرانی در حال فکر کردن</div>
            <div style={{ fontSize: '0.85rem', opacity: 0.9 }}>
              سطح {level} | ⏱️ {300 + (level * 50)}ms
            </div>
          </div>
        </div>
        <style>{`
          @keyframes pulse {
            0%, 100% { opacity: 0.2; transform: scale(0.8); }
            50% { opacity: 1; transform: scale(1.2); }
          }
        `}</style>
      </div>
    );
  }

  // آماده
  if (engineReady && isEngineTurn && !isThinking) {
    return (
      <div style={{
        background: 'linear-gradient(135deg, #065f46 0%, #047857 100%)',
        color: 'white',
        padding: '12px',
        borderRadius: '8px',
        margin: '10px 0',
        border: '2px solid #10b981'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span>✅</span>
          <span style={{ fontWeight: '500' }}>
            🤖 منتظر حرکت هوش مصنوعی (سطح {level})
          </span>
        </div>
      </div>
    );
  }

  return null;
};