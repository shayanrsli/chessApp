import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Chess, type Square } from "chess.js";
import type { Key } from "chessground/types";

import { useSignalR } from "../../hooks/useSignalR";
import { getPlayerId, getPlayerName } from "../../utils/playerUtils";
import { ChessBoardView } from "../ChessBoardView/ChessBoardView";

import "./ChessMultiplayer.css";

type Color = "white" | "black";

interface ChessMultiplayerProps {
  roomId: string;
  onBack: () => void;
  onNewGame?: () => void;
}

function fenToTurnColor(fen: string): Color {
  const parts = fen.trim().split(/\s+/);
  return parts[1] === "b" ? "black" : "white";
}

export function ChessMultiplayer({ roomId, onBack, onNewGame }: ChessMultiplayerProps) {
  const { connection, isConnected } = useSignalR();

  const gameRef = useRef<Chess>(new Chess());
  const isMountedRef = useRef(true);

  const playerId = useMemo(() => getPlayerId(), []);
  const playerName = useMemo(() => getPlayerName(), []);

  const [playerColor, setPlayerColor] = useState<Color | null>(null);
  const [opponentName, setOpponentName] = useState("در انتظار حریف");
  const [gameStatus, setGameStatus] = useState<"waiting" | "playing" | "finished">("waiting");

  const [fen, setFen] = useState<string>("start");
  const [moveCount, setMoveCount] = useState(0);
  const [lastMove, setLastMove] = useState<[Key, Key] | null>(null);

  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const [myTime, setMyTime] = useState(300);
  const [opponentTime, setOpponentTime] = useState(300);

  const [chatMessages, setChatMessages] = useState<Array<{ sender: string; text: string; time: string }>>([]);
  const [newMessage, setNewMessage] = useState("");

  const [winner, setWinner] = useState<Color | "draw" | null>(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const showMessage = useCallback((msg: string, duration = 2500) => {
    if (!isMountedRef.current) return;
    setMessage(msg);
    if (duration > 0) {
      setTimeout(() => {
        if (isMountedRef.current) setMessage("");
      }, duration);
    }
  }, []);

  const formatTime = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  }, []);

  // ✅ همیشه یک fen واقعی برای UI داشته باشیم
  const effectiveFen = useMemo(() => {
    return fen === "start" ? gameRef.current.fen() : fen;
  }, [fen]);

  // ✅ مهم: sync کردن chess.js با fen فعلی
  const ensureGameSynced = useCallback((targetFen: string) => {
    const g = gameRef.current;

    if (!targetFen) return;

    // فقط اگر واقعاً فرق داشت load کن (Performance)
    if (g.fen() !== targetFen) {
      try {
        g.load(targetFen);
      } catch {
        // ignore
      }
    }
  }, []);

  // ✅ نوبت را از effectiveFen بگیر (نه از fen که ممکنه "start" باشه)
  const activeSide = useMemo<Color>(() => {
    if (!effectiveFen) return "white";
    return fenToTurnColor(effectiveFen);
  }, [effectiveFen]);

  const isMyTurn = useMemo(() => {
    return !!playerColor && gameStatus === "playing" && playerColor === activeSide;
  }, [playerColor, gameStatus, activeSide]);

  const calculateDests = useCallback(() => {
    ensureGameSynced(effectiveFen);

    const game = gameRef.current;
    const dests = new Map<Key, Key[]>();
    const board = game.board();

    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = board[row][col];
        if (piece && piece.color === game.turn()) {
          const square = `${String.fromCharCode(97 + col)}${8 - row}` as Key;
          const moves = game.moves({ square: square as Square, verbose: true });
          if (moves.length > 0) dests.set(square, moves.map((m) => m.to as Key));
        }
      }
    }
    return dests;
  }, [effectiveFen, ensureGameSynced]);

  const dests = useMemo(() => {
    if (!isMyTurn) return new Map<Key, Key[]>();
    return calculateDests();
  }, [calculateDests, isMyTurn]);

  // ✅ Debug (همون چیزی که لازم داری)
  useEffect(() => {
    if (!playerColor) return;

    ensureGameSynced(effectiveFen);

    console.log("🧪 DEBUG =>", {
      playerColor,
      fen: effectiveFen,
      activeSide,
      chessTurn: gameRef.current.turn(),
      isMyTurn,
      destsKeys: dests.size
    });
  }, [playerColor, effectiveFen, activeSide, isMyTurn, dests, ensureGameSynced]);

  const handleMove = useCallback(
    async (from: Key, to: Key) => {
      if (!connection || !roomId || gameStatus !== "playing") return;

      if (!isMyTurn) {
        showMessage("⏳ نوبت شما نیست", 1500);
        return;
      }

      const beforeFen = effectiveFen;
      ensureGameSynced(beforeFen);

      let afterFen = beforeFen;
      try {
        const mv = gameRef.current.move({ from: from as Square, to: to as Square });
        if (!mv) {
          showMessage("❌ حرکت غیرمجاز", 2000);
          return;
        }
        afterFen = gameRef.current.fen();
      } catch {
        showMessage("❌ خطا در پردازش حرکت", 2000);
        return;
      }

      // optimistic UI
      setLastMove([from, to]);
      setFen(afterFen);

      try {
        const result = await connection.invoke("MakeMove", roomId, from, to, null, afterFen);
        if (!result?.success) {
          setFen(beforeFen);
          showMessage(result?.message || "❌ سرور حرکت را رد کرد", 2500);
        }
      } catch (e: any) {
        setFen(beforeFen);
        showMessage(e?.message || "❌ خطا در ارسال حرکت", 2500);
      }
    },
    [connection, roomId, gameStatus, isMyTurn, showMessage, effectiveFen, ensureGameSynced]
  );

  const handleSendMessage = useCallback(async () => {
    if (!connection || !roomId || !newMessage.trim()) return;
    try {
      await connection.invoke("SendGameMessage", roomId, newMessage.trim());
      setNewMessage("");
    } catch {
      showMessage("❌ خطا در ارسال پیام", 2500);
    }
  }, [connection, roomId, newMessage, showMessage]);

  // ✅ Events + EnsureJoined
  useEffect(() => {
    if (!connection || !isConnected || !roomId) return;

    let disposed = false;

    const normalizePlayer = (p: any) => {
      if (!p) return null;
      return {
        username: p.username ?? p.Username,
        userId: p.userId ?? p.UserId
      };
    };

    const onGameStarted = (data: any) => {
      if (!isMountedRef.current || disposed) return;

      const white = normalizePlayer(data?.whitePlayer ?? data?.WhitePlayer);
      const black = normalizePlayer(data?.blackPlayer ?? data?.BlackPlayer);
      const boardFen = data?.board ?? data?.Board;

      const isWhite = white?.userId === playerId;
      const isBlack = black?.userId === playerId;

      const color: Color = isWhite ? "white" : isBlack ? "black" : "white";
      setPlayerColor(color);

      setOpponentName(color === "white" ? black?.username ?? "حریف" : white?.username ?? "حریف");
      setGameStatus("playing");

      if (boardFen) setFen(boardFen);
      setMoveCount(0);

      setIsLoading(false);
      showMessage("🎮 بازی شروع شد!", 2000);
    };

    const onMoveMade = (data: any) => {
      if (!isMountedRef.current || disposed) return;

      if (data?.fen) setFen(data.fen);
      if (data?.from && data?.to) setLastMove([data.from as Key, data.to as Key]);

      setMoveCount(data?.moveNumber ?? 0);
    };

    const onPlayerJoined = (data: any) => {
      if (!isMountedRef.current || disposed) return;
      const p = normalizePlayer(data?.player ?? data?.Player);
      if (p?.username) setOpponentName(p.username);
    };

    const onGameMessage = (data: any) => {
      if (!isMountedRef.current || disposed) return;
      const t = new Date(data?.timestamp ?? Date.now());
      const time = `${t.getHours()}:${String(t.getMinutes()).padStart(2, "0")}`;
      setChatMessages((prev) => [...prev, { sender: data?.sender ?? "Unknown", text: data?.text ?? "", time }]);
    };

    connection.on("GameStarted", onGameStarted);
    connection.on("MoveMade", onMoveMade);
    connection.on("PlayerJoined", onPlayerJoined);
    connection.on("GameMessage", onGameMessage);

    const ensure = async () => {
      try {
        setIsLoading(true);

        const result = await connection.invoke("EnsureJoined", roomId, playerName, playerId);

        if (!result?.success) {
          setIsLoading(false);
          showMessage(result?.message || "❌ خطا در ورود", 4000);
          return;
        }

        setPlayerColor(result.yourColor as Color);
        setOpponentName(result.opponent || "در انتظار حریف");
        setMoveCount(result.moveCount || 0);

        const status = (result.status || "WaitingForPlayer") as string;
        setGameStatus(status === "InProgress" ? "playing" : "waiting");

        if (result.fen) setFen(result.fen);

        setIsLoading(false);
      } catch (e: any) {
        setIsLoading(false);
        showMessage(e?.message || "❌ خطا در اتصال", 4000);
      }
    };

    ensure();

    return () => {
      disposed = true;
      connection.off("GameStarted", onGameStarted);
      connection.off("MoveMade", onMoveMade);
      connection.off("PlayerJoined", onPlayerJoined);
      connection.off("GameMessage", onGameMessage);
    };
  }, [connection, isConnected, roomId, playerId, playerName, showMessage]);

  // ✅ Timer strictly follows activeSide
  useEffect(() => {
    if (gameStatus !== "playing") return;
    if (!playerColor) return;

    const timer = setInterval(() => {
      if (!isMountedRef.current) return;

      const tickingMine = activeSide === playerColor;

      if (tickingMine) {
        setMyTime((t) => {
          if (t <= 1) {
            setGameStatus("finished");
            setWinner(playerColor === "white" ? "black" : "white");
            showMessage("⏰ زمان شما تمام شد!", 4000);
            return 0;
          }
          return t - 1;
        });
      } else {
        setOpponentTime((t) => Math.max(0, t - 1));
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [gameStatus, playerColor, activeSide, showMessage]);

  if (isLoading) {
    return (
      <div className="multiplayer-loading">
        <div className="loading-spinner"></div>
        <p>🎮 در حال اتصال...</p>
        <p>🔗 اتاق: {roomId}</p>
        <button className="back-btn" onClick={onBack} style={{ marginTop: 20 }}>
          ← بازگشت
        </button>
      </div>
    );
  }

  return (
    <div className="chess-multiplayer" dir="rtl">
      <header className="multiplayer-header">
        <button className="back-btn" onClick={onBack}>
          ← خانه
        </button>

        <div className="game-info">
          <div className="room-info">
            🎮 بازی شطرنج
            <span className="room-id">شناسه: {roomId.slice(0, 8)}...</span>
          </div>
          <div className={`game-status ${gameStatus}`}>
            {gameStatus === "waiting" && "⏳ منتظر حریف"}
            {gameStatus === "playing" && `🎮 در حال بازی | نوبت: ${activeSide === "white" ? "سفید" : "مشکی"}`}
            {gameStatus === "finished" && "🏁 پایان"}
          </div>
        </div>
      </header>

      <div className="players-info">
        <div className={`player-card ${playerColor === "white" ? "me" : "opponent"}`}>
          <div className="player-color white">⚪</div>
          <div className="player-details">
            <h3>{playerColor === "white" ? playerName : opponentName}</h3>
            <p>سفید</p>
          </div>
          <div className={`player-timer ${activeSide === "white" && playerColor === "white" ? "active" : ""}`}>
            {formatTime(playerColor === "white" ? myTime : opponentTime)}
          </div>
        </div>

        <div className="vs-indicator">🎮</div>

        <div className={`player-card ${playerColor === "black" ? "me" : "opponent"}`}>
          <div className="player-color black">⚫</div>
          <div className="player-details">
            <h3>{playerColor === "black" ? playerName : opponentName}</h3>
            <p>سیاه</p>
          </div>
          <div className={`player-timer ${activeSide === "black" && playerColor === "black" ? "active" : ""}`}>
            {formatTime(playerColor === "black" ? myTime : opponentTime)}
          </div>
        </div>
      </div>

      {/* ✅ Board */}
      <div className="chess-board-container">
        {playerColor ? (
          <ChessBoardView
            className="multiplayer-board"
            fen={effectiveFen}
            orientation={playerColor}
            turnColor={activeSide} // ✅ تغییر اصلی
            movableColor={isMyTurn ? playerColor : null}
            dests={dests}
            onMove={handleMove}
            lastMove={lastMove}
            viewOnly={gameStatus !== "playing"}
          />
        ) : (
          <div className="multiplayer-board-placeholder">در حال تنظیم بورد...</div>
        )}
      </div>

      <div className="game-status-bar">
        <div className="status-item">
          <span>نوبت:</span>
          <strong>{isMyTurn ? "شما" : opponentName}</strong>
        </div>
        <div className="status-item">
          <span>حرکت:</span>
          <strong>{moveCount}</strong>
        </div>
      </div>

      <div className="game-chat">
        <h4>💬 چت بازی</h4>
        <div className="chat-messages">
          {chatMessages.length === 0 ? (
            <div className="no-messages">هیچ پیامی ارسال نشده</div>
          ) : (
            chatMessages.map((msg, i) => (
              <div key={i} className={`message ${msg.sender === playerName ? "my-message" : "opponent-message"}`}>
                <div className="message-sender">{msg.sender}</div>
                <div className="message-text">{msg.text}</div>
                <div className="message-time">{msg.time}</div>
              </div>
            ))
          )}
        </div>

        <div className="chat-input">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="پیام..."
            onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
          />
          <button onClick={handleSendMessage}>📤</button>
        </div>
      </div>

      {message && (
        <div className="message-toast">
          <div className="message-content">{message}</div>
          <button onClick={() => setMessage("")}>✕</button>
        </div>
      )}

      {gameStatus === "finished" && (
        <div className="game-result-overlay">
          <div className="result-content">
            <h2>🎮 بازی پایان یافت</h2>
            <p className="result-text">
              {winner === "draw" ? "مساوی!" : winner === playerColor ? "شما بردید 🎉" : `${opponentName} برد`}
            </p>
            <div className="result-actions">
              {onNewGame && (
                <button className="result-btn new-game" onClick={onNewGame}>
                  🆕 بازی جدید
                </button>
              )}
              <button className="result-btn home" onClick={onBack}>
                🏠 خانه
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}