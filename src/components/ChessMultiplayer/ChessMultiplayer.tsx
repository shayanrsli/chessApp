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

  const effectiveFen = useMemo(() => {
    return fen === "start" ? gameRef.current.fen() : fen;
  }, [fen]);

  const ensureGameSynced = useCallback((targetFen: string) => {
    const g = gameRef.current;
    if (!targetFen) return;

    if (g.fen() !== targetFen) {
      try {
        g.load(targetFen);
      } catch {
        // ignore
      }
    }
  }, []);

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

  useEffect(() => {
    if (!connection || !isConnected || !roomId) return;

    let disposed = false;

    const normalizePlayer = (p: any) => {
      if (!p) return null;
      return {
        username: p.username ?? p.Username,
        userId: p.userId ?? p.UserId,
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
      <div className="cm" dir="rtl">
        <header className="cm__header">
          <button className="cm__iconBtn" onClick={onBack} type="button" aria-label="بازگشت">
            <span aria-hidden="true">←</span>
            <span className="cm__iconBtnText">بازگشت</span>
          </button>
          <div className="cm__titleWrap">
            <h1 className="cm__title">اتصال به بازی</h1>
            <p className="cm__subtitle">لطفاً چند لحظه صبر کن…</p>
          </div>
          <div className="cm__statusPill" aria-live="polite">
            <span className={`cm__dot ${isConnected ? "is-online" : "is-offline"}`} aria-hidden="true" />
            {isConnected ? "آنلاین" : "آفلاین"}
          </div>
        </header>

        <main className="cm__loadingCard" aria-label="در حال اتصال">
          <div className="cm__spinner" aria-hidden="true" />
          <div className="cm__loadingText">🎮 در حال اتصال…</div>
          <div className="cm__roomCode">
            <span>اتاق:</span>
            <code className="cm__mono" title={roomId}>
              {roomId}
            </code>
          </div>
          <button className="cm__btn cm__btn--ghost" onClick={onBack} type="button">
            ← بازگشت
          </button>
        </main>
      </div>
    );
  }

  return (
    <div className="cm" dir="rtl">
      <header className="cm__header">
        <button className="cm__iconBtn" onClick={onBack} type="button" aria-label="خانه">
          <span aria-hidden="true">←</span>
          <span className="cm__iconBtnText">خانه</span>
        </button>

        <div className="cm__titleWrap">
          <h1 className="cm__title">بازی شطرنج</h1>
          <div className="cm__metaRow">
            <span className="cm__metaChip">
              شناسه:
              <code className="cm__mono" title={roomId}>
                {roomId.slice(0, 8)}…
              </code>
            </span>

            <span className={`cm__badge cm__badge--${gameStatus}`}>
              {gameStatus === "waiting" && "⏳ منتظر حریف"}
              {gameStatus === "playing" && `🎮 در حال بازی | نوبت: ${activeSide === "white" ? "سفید" : "مشکی"}`}
              {gameStatus === "finished" && "🏁 پایان"}
            </span>
          </div>
        </div>

        <div className="cm__statusPill" aria-live="polite" aria-label="وضعیت اتصال">
          <span className={`cm__dot ${isConnected ? "is-online" : "is-offline"}`} aria-hidden="true" />
          {isConnected ? "آنلاین" : "آفلاین"}
        </div>
      </header>

      <main className="cm__content">
        <section className="cm__players" aria-label="اطلاعات بازیکنان">
          <div className={`cm__player ${playerColor === "white" ? "is-me" : ""}`}>
            <div className="cm__piece" aria-hidden="true">
              ⚪
            </div>
            <div className="cm__playerInfo">
              <div className="cm__playerName">{playerColor === "white" ? playerName : opponentName}</div>
              <div className="cm__playerSub">سفید</div>
            </div>
            <div
              className={`cm__timer ${
                activeSide === "white" && playerColor === "white" && gameStatus === "playing" ? "is-active" : ""
              } ${playerColor === "white" ? (myTime <= 30 ? "is-critical" : "") : opponentTime <= 30 ? "is-critical" : ""}`}
              aria-label="زمان سفید"
            >
              {formatTime(playerColor === "white" ? myTime : opponentTime)}
            </div>
          </div>

          <div className="cm__vs" aria-hidden="true">
            🎮
          </div>

          <div className={`cm__player ${playerColor === "black" ? "is-me" : ""}`}>
            <div className="cm__piece" aria-hidden="true">
              ⚫
            </div>
            <div className="cm__playerInfo">
              <div className="cm__playerName">{playerColor === "black" ? playerName : opponentName}</div>
              <div className="cm__playerSub">سیاه</div>
            </div>
            <div
              className={`cm__timer ${
                activeSide === "black" && playerColor === "black" && gameStatus === "playing" ? "is-active" : ""
              } ${playerColor === "black" ? (myTime <= 30 ? "is-critical" : "") : opponentTime <= 30 ? "is-critical" : ""}`}
              aria-label="زمان سیاه"
            >
              {formatTime(playerColor === "black" ? myTime : opponentTime)}
            </div>
          </div>
        </section>

        <section className="cm__boardCard" aria-label="صفحه شطرنج">
          <div className="cm__boardWrap">
            {playerColor ? (
              <ChessBoardView
                className="cm__board multiplayer-board"
                fen={effectiveFen}
                orientation={playerColor}
                turnColor={activeSide}
                movableColor={isMyTurn ? playerColor : null}
                dests={dests}
                onMove={handleMove}
                lastMove={lastMove}
                viewOnly={gameStatus !== "playing"}
              />
            ) : (
              <div className="cm__boardPlaceholder">در حال تنظیم بورد…</div>
            )}
          </div>

          <div className="cm__statusBar" aria-label="وضعیت بازی">
            <div className="cm__statusItem">
              <span className="cm__statusLabel">نوبت</span>
              <strong className="cm__statusValue">{isMyTurn ? "شما" : opponentName}</strong>
            </div>
            <div className="cm__divider" aria-hidden="true" />
            <div className="cm__statusItem">
              <span className="cm__statusLabel">حرکت</span>
              <strong className="cm__statusValue">{moveCount}</strong>
            </div>
          </div>
        </section>

        <section className="cm__chatCard" aria-label="چت بازی">
          <div className="cm__chatHeader">
            <h2 className="cm__chatTitle">💬 چت بازی</h2>
            <div className="cm__chatHint">پیام‌ها فقط داخل همین بازی هستند</div>
          </div>

          <div className="cm__chatMessages" role="log" aria-live="polite">
            {chatMessages.length === 0 ? (
              <div className="cm__empty">هیچ پیامی ارسال نشده</div>
            ) : (
              chatMessages.map((msg, i) => {
                const mine = msg.sender === playerName;
                return (
                  <div key={i} className={`cm__msg ${mine ? "is-mine" : "is-theirs"}`}>
                    <div className="cm__msgMeta">
                      <span className="cm__msgSender">{mine ? "شما" : msg.sender}</span>
                      <span className="cm__msgTime">{msg.time}</span>
                    </div>
                    <div className="cm__msgBubble">{msg.text}</div>
                  </div>
                );
              })
            )}
          </div>

          <div className="cm__chatInputRow">
            <input
              className="cm__chatInput"
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="پیام…"
              onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
              disabled={!isConnected}
              aria-label="متن پیام"
            />
            <button className="cm__sendBtn" onClick={handleSendMessage} type="button" disabled={!isConnected || !newMessage.trim()}>
              📤
            </button>
          </div>
        </section>
      </main>

      {message && (
        <div className="cm__toast" role="status" aria-live="polite">
          <div className="cm__toastText">{message}</div>
          <button className="cm__toastClose" onClick={() => setMessage("")} type="button" aria-label="بستن">
            ✕
          </button>
        </div>
      )}

      {gameStatus === "finished" && (
        <div className="cm__overlay" role="dialog" aria-modal="true" aria-label="نتیجه بازی">
          <div className="cm__resultCard">
            <h2 className="cm__resultTitle">🎮 بازی پایان یافت</h2>
            <p className="cm__resultText">
              {winner === "draw" ? "مساوی!" : winner === playerColor ? "شما بردید 🎉" : `${opponentName} برد`}
            </p>

            <div className="cm__resultActions">
              {onNewGame && (
                <button className="cm__btn cm__btn--primary" onClick={onNewGame} type="button">
                  🆕 بازی جدید
                </button>
              )}
              <button className="cm__btn cm__btn--ghost" onClick={onBack} type="button">
                🏠 خانه
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
