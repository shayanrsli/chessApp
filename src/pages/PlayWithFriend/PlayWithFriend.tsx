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
          detail: { roomId },
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
    window.open(telegramUrl, "_blank", "noopener,noreferrer");
  };

  const canCreate = isConnected && !loading;
  const canJoin = isConnected && !loading && !!inviteCode.trim();

  return (
    <div className="pwf" dir="rtl">
      <header className="pwf__header">
        <button className="pwf__iconBtn" onClick={onBack} type="button" aria-label="بازگشت">
          <span className="pwf__iconBtnIcon" aria-hidden="true">
            ←
          </span>
          <span className="pwf__iconBtnText">بازگشت</span>
        </button>

        <div className="pwf__titleWrap">
          <h1 className="pwf__title">بازی با دوست</h1>
          <p className="pwf__subtitle">اتاق بساز یا با کد دعوت وارد شو</p>
        </div>

        <div className="pwf__status" aria-live="polite" aria-label="وضعیت اتصال">
          <span className={`pwf__dot ${isConnected ? "is-online" : "is-offline"}`} aria-hidden="true" />
          <span className="pwf__statusText">{isConnected ? "آنلاین" : "آفلاین"}</span>
        </div>
      </header>

      <main className="pwf__content">
        <section className="pwf__card">
          <div className="pwf__segmented" role="tablist" aria-label="انتخاب حالت">
            <button
              type="button"
              role="tab"
              aria-selected={mode === "create"}
              className={`pwf__segBtn ${mode === "create" ? "is-active" : ""}`}
              onClick={() => setMode("create")}
              disabled={loading}
            >
              🆕 ایجاد بازی
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "join"}
              className={`pwf__segBtn ${mode === "join" ? "is-active" : ""}`}
              onClick={() => setMode("join")}
              disabled={loading}
            >
              🔗 پیوستن
            </button>
          </div>

          {(error || success) && (
            <div className="pwf__alerts" aria-live="polite">
              {error && (
                <div className="pwf__alert pwf__alert--error" role="alert">
                  <span className="pwf__alertIcon" aria-hidden="true">
                    ⚠️
                  </span>
                  <div className="pwf__alertText">{error}</div>
                </div>
              )}
              {success && (
                <div className="pwf__alert pwf__alert--success" role="status">
                  <span className="pwf__alertIcon" aria-hidden="true">
                    ✅
                  </span>
                  <div className="pwf__alertText">{success}</div>
                </div>
              )}
            </div>
          )}

          {mode === "create" ? (
            <div className="pwf__section" role="tabpanel">
              <div className="pwf__sectionHeader">
                <h2 className="pwf__h2">ایجاد بازی جدید</h2>
                <p className="pwf__hint">بعد از ساخت، کد دعوت را برای دوستت بفرست.</p>
              </div>

              <div className="pwf__field">
                <label className="pwf__label" htmlFor="pwf-game-name">
                  نام بازی
                </label>
                <input
                  id="pwf-game-name"
                  className="pwf__input"
                  type="text"
                  value={gameName}
                  onChange={(e) => setGameName(e.target.value)}
                  placeholder="مثلاً: بازی شطرنج علی"
                  disabled={loading}
                  autoComplete="off"
                />
              </div>

              <button className="pwf__btn pwf__btn--primary" onClick={handleCreateGame} disabled={!canCreate} type="button">
                {loading ? (
                  <>
                    <span className="pwf__spinner" aria-hidden="true" />
                    در حال ایجاد...
                  </>
                ) : (
                  <>🎮 ایجاد بازی</>
                )}
              </button>

              {createdGame && (
                <div className="pwf__infoCard" aria-label="اطلاعات بازی ایجاد شده">
                  <div className="pwf__infoHeader">
                    <h3 className="pwf__h3">بازی ایجاد شد</h3>
                    <span className="pwf__pill">منتظر نفر دوم</span>
                  </div>

                  <div className="pwf__kv">
                    <div className="pwf__kvLabel">شناسه</div>
                    <button
                      type="button"
                      className="pwf__copy"
                      onClick={() => void copyToClipboard(createdGame.roomId)}
                      aria-label="کپی شناسه"
                    >
                      <code className="pwf__code" title={createdGame.roomId}>
                        {createdGame.roomId}
                      </code>
                      <span className="pwf__copyIcon" aria-hidden="true">
                        📋
                      </span>
                    </button>
                  </div>

                  {createdGame.inviteCode && (
                    <div className="pwf__kv">
                      <div className="pwf__kvLabel">کد دعوت</div>
                      <button
                        type="button"
                        className="pwf__copy"
                        onClick={() => void copyToClipboard(createdGame.inviteCode)}
                        aria-label="کپی کد دعوت"
                      >
                        <code className="pwf__code" title={createdGame.inviteCode}>
                          {createdGame.inviteCode}
                        </code>
                        <span className="pwf__copyIcon" aria-hidden="true">
                          📋
                        </span>
                      </button>
                    </div>
                  )}

                  <div className="pwf__actions">
                    <button className="pwf__btn pwf__btn--telegram" onClick={shareToTelegram} type="button">
                      📨 اشتراک در تلگرام
                    </button>
                  </div>

                  <div className="pwf__note">
                    ⏳ وقتی بازیکن دوم وارد شود، با رخداد <span className="pwf__noteCode">GameStarted</span> خودکار وارد بازی می‌شوید.
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="pwf__section" role="tabpanel">
              <div className="pwf__sectionHeader">
                <h2 className="pwf__h2">پیوستن به بازی</h2>
                <p className="pwf__hint">کد دعوت ۸ کاراکتری را وارد کن.</p>
              </div>

              <div className="pwf__field">
                <label className="pwf__label" htmlFor="pwf-invite-code">
                  کد دعوت
                </label>
                <input
                  id="pwf-invite-code"
                  className="pwf__input pwf__input--mono"
                  type="text"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                  placeholder="مثلاً: A1B2C3D4"
                  maxLength={8}
                  disabled={loading}
                  autoComplete="off"
                  inputMode="text"
                  style={{ textTransform: "uppercase" }}
                />
                <div className="pwf__microHint">بعد از پیوستن، منتظر شروع بازی بمان (GameStarted).</div>
              </div>

              <button className="pwf__btn pwf__btn--primary" onClick={handleJoinByCode} disabled={!canJoin} type="button">
                {loading ? (
                  <>
                    <span className="pwf__spinner" aria-hidden="true" />
                    در حال اتصال...
                  </>
                ) : (
                  <>🎮 پیوستن</>
                )}
              </button>

              <div className="pwf__note">
                نکته: اگر آفلاین هستی، اول اتصال SignalR باید برقرار شود.
              </div>
            </div>
          )}
        </section>

        <section className="pwf__footerCard">
          <p className="pwf__footerText">🤝 نفر اول بازی را بسازد، نفر دوم با کد دعوت وارد شود.</p>
        </section>
      </main>
    </div>
  );
}
