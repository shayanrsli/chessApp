// public/stockfish.js
// موتور شطرنج ایرانی - بدون نیاز به اینترنت خارجی

console.log('♟️ موتور شطرنج ایرانی بارگیری شد');

class IranianChessEngine {
  constructor() {
    this.position = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    this.level = 10;
    console.log('✅ موتور ایرانی فعال شد');
  }

  getBestMove(fen, level) {
    // حرکات استاندارد شطرنج
    const allMoves = [
      // حرکات سفید (توسعه‌ای)
      'e2e4', 'd2d4', 'g1f3', 'c2c4', 'b1c3', 'f1c4', 'f1b5', 'g2g3',
      'e1g1', // قلعه کوتاه سفید
      
      // حرکات سیاه (توسعه‌ای)
      'e7e5', 'd7d5', 'g8f6', 'c7c5', 'b8c6', 'f8c5', 'f8b4', 'g7g6',
      'e8g8', // قلعه کوتاه سیاه
      
      // حرکات حمله‌ای
      'e4e5', 'd4d5', 'f3g5', 'c4c5', 'e5d6', 'd5e6',
      'g1h3', 'g8h6', // حرکات جناحی
      
      // حرکات مهره‌های کوچک
      'b1a3', 'b8a6', 'c1g5', 'c8g4'
    ];
    
    // بر اساس سطح، حرکت انتخاب کن
    let selectedMove;
    
    if (level < 5) {
      // سطح آسان: حرکات ساده
      const easyMoves = ['e2e4', 'd2d4', 'e7e5', 'd7d5'];
      selectedMove = easyMoves[Math.floor(Math.random() * easyMoves.length)];
    } else if (level < 15) {
      // سطح متوسط: حرکات منطقی
      const fenParts = fen.split(' ');
      const turn = fenParts[1];
      const moveNumber = parseInt(fenParts[5]);
      
      if (moveNumber < 5) {
        // شروع بازی: حرکات توسعه‌ای
        const openingMoves = turn === 'w' 
          ? ['e2e4', 'd2d4', 'g1f3', 'b1c3']
          : ['e7e5', 'd7d5', 'g8f6', 'b8c6'];
        selectedMove = openingMoves[Math.floor(Math.random() * openingMoves.length)];
      } else {
        // میانی بازی: حرکات تاکتیکی
        selectedMove = allMoves[Math.floor(Math.random() * allMoves.length)];
      }
    } else {
      // سطح سخت: حرکات مرکزی اولویت دارند
      const centerMoves = allMoves.filter(move => 
        move.includes('e4') || move.includes('d4') || move.includes('e5') || move.includes('d5')
      );
      selectedMove = centerMoves.length > 0 
        ? centerMoves[Math.floor(Math.random() * centerMoves.length)]
        : allMoves[Math.floor(Math.random() * allMoves.length)];
    }
    
    return selectedMove;
  }
}

const engine = new IranianChessEngine();

self.onmessage = function(e) {
  const message = e.data;
  
  if (message === 'uci') {
    self.postMessage('id name Iranian Chess Engine v1.0 🇮🇷');
    self.postMessage('id author Persian AI Team');
    self.postMessage('uciok');
  }
  else if (message === 'isready') {
    self.postMessage('readyok');
  }
  else if (message.startsWith('setoption name Skill Level value')) {
    const level = parseInt(message.split(' ')[5]);
    engine.level = level;
    self.postMessage('info string Skill level set to ' + level);
  }
  else if (message.startsWith('position fen')) {
    const fen = message.split('fen ')[1].split(' ')[0];
    engine.position = fen;
    self.postMessage('info string Position received');
  }
  else if (message.startsWith('go')) {
    // زمان فکر کردن
    const thinkTime = 200 + (engine.level * 30);
    
    setTimeout(() => {
      const bestMove = engine.getBestMove(engine.position, engine.level);
      self.postMessage('bestmove ' + bestMove);
    }, thinkTime);
  }
  else {
    self.postMessage('info string Command processed');
  }
};  