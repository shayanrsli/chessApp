import { useEffect, useMemo, useRef, useState } from "react";
import { useTelegramUser } from "../../hooks/useTelegramUser";
import { useSignalR } from "../../hooks/useSignalR";
import { getPlayerId, getPlayerName } from "../../utils/playerUtils";
import "./PlayWithFriend.css";

type Mode = "create" | "join";

export function PlayWithFriend({ onBack }: { onBack: () => void }) {
  const { username } = useTelegramUser();
  const { connection, isConnected, error: signalRError } = useSignalR();

  const [mode, setMode] = useState<Mode>("create");
  const [gameName, setGameName] = useState("");
  const [inviteCode, setInviteCode] = useState("");

  const [createdGame, setCreatedGame] = useState<any>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const hasNavigatedRef = useRef(false);

  const playerId = useMemo(() => getPlayerId(), []);
  const playerName = useMemo(() => getPlayerName(), []);

  useEffect(() => {
    setGameName(`${username || "Guest"}'s Game`);
  }, [username]);

  // ✅ فقط GameStarted باعث navigate می‌شود
  useEffect(() => {
    if (!connection) return;

    const onGameStarted = (data: any) => {
      console.log("🚀 GameStarted event in PlayWithFriend:", data);

      // ✅ چون signalr camelCase می‌کند:
      const roomId = data?.roomId ?? data?.RoomId;
      if (!roomId) {
        console.warn("❌ GameStarted received but roomId is missing (check casing).");
        return;
      }

      if (hasNavigatedRef.current) return;
      hasNavigatedRef.current = true;

      setSuccess("🎮 بازی شروع شد! انتقال به صفحه بازی...");
      setError("");

      window.dispatchEvent(
        new CustomEvent("navigateToGame", {
          detail: { roomId }
        })
      );
    };

    connection.on("GameStarted", onGameStarted);

    return () => {
      connection.off("GameStarted", onGameStarted);
    };
  }, [connection]);

  useEffect(() => {
    if (signalRError) setError(signalRError);
  }, [signalRError]);

  useEffect(() => {
    if (!error && !success) return;
    const t = setTimeout(() => {
      setError("");
      setSuccess("");
    }, 5000);
    return () => clearTimeout(t);
  }, [error, success]);

  const handleCreateGame = async () => {
    if (!connection || !isConnected) {
      setError("🔌 اتصال به سرور برقرار نیست");
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");
    hasNavigatedRef.current = false;

    try {
      const result = await connection.invoke("CreateGame", gameName || "Chess Game", playerName, playerId);

      console.log("✅ CreateGame result:", result);

      if (!result?.success || !result?.roomId) {
        setError(result?.message || "❌ خطا در ایجاد بازی");
        return;
      }

      setCreatedGame(result);
      setSuccess("✅ بازی ساخته شد. کد دعوت را برای دوستتان ارسال کنید.");

      sessionStorage.setItem("last_room_id", result.roomId);
      sessionStorage.setItem("last_player_id", playerId);
      sessionStorage.setItem("last_player_color", "white");

      if (result.inviteCode) {
        try {
          await navigator.clipboard.writeText(result.inviteCode);
          setSuccess(`✅ بازی ساخته شد. کد دعوت کپی شد: ${result.inviteCode}`);
        } catch {
          // ignore
        }
      }
    } catch (e: any) {
      console.error("❌ CreateGame error:", e);
      setError(e?.message || "❌ خطای غیرمنتظره در ایجاد بازی");
    } finally {
      setLoading(false);
    }
  };

  const handleJoinByCode = async () => {
    const code = inviteCode.trim().toUpperCase();
    if (!code) {
      setError("🔑 لطفاً کد دعوت را وارد کنید");
      return;
    }

    if (!connection || !isConnected) {
      setError("🔌 اتصال به سرور برقرار نیست");
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");
    hasNavigatedRef.current = false;

    try {
      const result = await connection.invoke("JoinByInviteCode", code, playerName, playerId);

      console.log("✅ JoinByInviteCode result:", result);

      if (!result?.success) {
        setError(result?.message || "❌ خطا در پیوستن با کد دعوت");
        return;
      }

      // نتیجه EnsureJoined هم camelCase است
      const roomId = result?.roomId ?? result?.RoomId;
      if (roomId) {
        sessionStorage.setItem("last_room_id", roomId);
        sessionStorage.setItem("last_player_id", playerId);
        sessionStorage.setItem("last_player_color", result.yourColor || "black");
      }

      setSuccess("✅ وارد بازی شدید. منتظر شروع بازی... (GameStarted)");
      // اینجا navigate نکن. GameStarted برای هر دو نفر سینک می‌آید.
    } catch (e: any) {
      console.error("❌ JoinByInviteCode error:", e);
      setError(e?.message || "❌ خطای غیرمنتظره در پیوستن");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setSuccess("📋 کپی شد!");
    } catch {
      setError("❌ اجازه کپی داده نشد");
    }
  };

  const shareToTelegram = () => {
    if (!createdGame?.inviteCode && !createdGame?.roomId) return;

    let text = "به بازی شطرنج من بپیوند! 🎮\n";
    if (createdGame?.inviteCode) text += `کد دعوت: ${createdGame.inviteCode}\n`;
    if (createdGame?.roomId) text += `شناسه بازی: ${createdGame.roomId}`;

    const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(window.location.href)}&text=${encodeURIComponent(
      text
    )}`;
    window.open(telegramUrl, "_blank");
  };

  return (
    <div className="play-with-friend" dir="rtl">
      <header className="friend-header">
        <button className="back-btn" onClick={onBack}>
          ← بازگشت
        </button>
        <h1>🎮 بازی با دوست</h1>
        <div className="connection-status">
          <span className={`status-dot ${isConnected ? "connected" : "disconnected"}`}></span>
          {isConnected ? "آنلاین" : "آفلاین"}
        </div>
      </header>

      <main className="friend-content">
        <div className="mode-tabs">
          <button className={`tab-btn ${mode === "create" ? "active" : ""}`} onClick={() => setMode("create")}>
            🆕 ایجاد بازی
          </button>
          <button className={`tab-btn ${mode === "join" ? "active" : ""}`} onClick={() => setMode("join")}>
            🔗 پیوستن
          </button>
        </div>

        {error && <div className="alert alert-error">⚠️ {error}</div>}
        {success && <div className="alert alert-success">✅ {success}</div>}

        {mode === "create" ? (
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

            <button className="primary-btn" onClick={handleCreateGame} disabled={loading || !isConnected}>
              {loading ? "در حال ایجاد..." : "🎮 ایجاد بازی"}
            </button>

            {createdGame && (
              <div className="game-info">
                <h3>✅ بازی ایجاد شد</h3>

                <div className="info-item">
                  <strong>شناسه:</strong>
                  <div className="copy-field" onClick={() => void copyToClipboard(createdGame.roomId)}>
                    <code>{createdGame.roomId}</code>
                    <span className="copy-icon">📋</span>
                  </div>
                </div>

                {createdGame.inviteCode && (
                  <div className="info-item">
                    <strong>کد دعوت:</strong>
                    <div className="copy-field" onClick={() => void copyToClipboard(createdGame.inviteCode)}>
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

                <div className="waiting-note">⏳ منتظر بازیکن دوم... (با GameStarted خودکار وارد بازی می‌شوید)</div>
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
                    placeholder="کد دعوت (8 کاراکتر)"
                    maxLength={8}
                    disabled={loading}
                    style={{ textTransform: "uppercase" }}
                  />
                </div>

                <button
                  className="join-btn"
                  onClick={handleJoinByCode}
                  disabled={loading || !inviteCode.trim() || !isConnected}
                >
                  {loading ? "در حال اتصال..." : "🎮 پیوستن"}
                </button>

                <div className="help-text" style={{ marginTop: 10 }}>
                  بعد از پیوستن، وقتی GameStarted بیاید، خودکار وارد صفحه بازی می‌شوید.
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="friend-footer">
        <p className="help-text">🤝 نفر اول بازی را بسازد، نفر دوم با کد دعوت وارد شود.</p>
      </footer>
    </div>
  );
}
