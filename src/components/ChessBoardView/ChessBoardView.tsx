// import { useEffect, useMemo, useRef } from "react";
// import { Chessground } from "chessground";
// import type { Api, Config } from "chessground/api";
// import type { Key } from "chessground/types";

// import "chessground/assets/chessground.base.css";
// import "chessground/assets/chessground.brown.css";
// import "chessground/assets/chessground.cburnett.css";

// type Color = "white" | "black";

// export type ChessBoardViewProps = {
//   className?: string;

//   fen: string;
//   orientation: Color;

//   // ✅ مهم: نوبت فعلی (از روی FEN)
//   turnColor: Color;

//   // if null => user can't move
//   movableColor: Color | null;

//   dests: Map<Key, Key[]>;
//   onMove: (from: Key, to: Key) => void | Promise<void>;

//   lastMove?: [Key, Key] | null;
//   viewOnly?: boolean;
// };

// function fenTurn(fen: string): "w" | "b" | "?" {
//   const parts = fen.trim().split(/\s+/);
//   return (parts[1] as any) ?? "?";
// }

// export function ChessBoardView({
//   className,
//   fen,
//   orientation,
//   turnColor,
//   movableColor,
//   dests,
//   onMove,
//   lastMove = null,
//   viewOnly = false
// }: ChessBoardViewProps) {
//   const containerRef = useRef<HTMLDivElement | null>(null);
//   const cgRef = useRef<Api | null>(null);

//   // ✅ برای سازگاری ۱۰۰٪، dests را به object تبدیل می‌کنیم (به جای Map)
//   const destsObj = useMemo(() => {
//     const obj: Record<string, Key[]> = {};
//     for (const [k, v] of dests.entries()) obj[k] = v;
//     return obj as any;
//   }, [dests]);

//   const movable = useMemo((): Config["movable"] => {
//     if (viewOnly || !movableColor) {
//       return {
//         free: false,
//         color: undefined,
//         dests: {},
//         showDests: false,
//         events: {}
//       };
//     }

//     return {
//       free: false,
//       color: movableColor,
//       dests: destsObj,
//       showDests: true,
//       events: {
//         after: (from: Key, to: Key) => {
//           void Promise.resolve(onMove(from, to));
//         }
//       }
//     };
//   }, [viewOnly, movableColor, destsObj, onMove]);

//   // ✅ create once
//   useEffect(() => {
//     if (!containerRef.current) return;

//     const cfg: Config = {
//       fen,
//       orientation,
//       turnColor, // ✅ ریشه مشکل همین بود
//       coordinates: false,
//       viewOnly,
//       highlight: { lastMove: true, check: true },
//       animation: { enabled: true, duration: 200 },
//       movable,
//       premovable: { enabled: false }, // ✅ برای جلوگیری از نقطه‌های طوسی
//       draggable: { enabled: !viewOnly, showGhost: true, distance: 3 },
//       selectable: { enabled: !viewOnly }
//     };

//     cgRef.current = Chessground(containerRef.current, cfg);

//     return () => {
//       try {
//         cgRef.current?.destroy?.();
//       } catch {}
//       cgRef.current = null;
//     };
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, []);

//   // ✅ update on every prop change
//   useEffect(() => {
//     const cg = cgRef.current;
//     if (!cg) return;

//     const nextCfg: Config = {
//       fen,
//       orientation,
//       turnColor, // ✅ اینجا هم باید ست شود
//       viewOnly,
//       movable,
//       premovable: { enabled: false },
//       draggable: { enabled: !viewOnly, showGhost: true, distance: 3 },
//       selectable: { enabled: !viewOnly },
//       highlight: { lastMove: true, check: true }
//     };

//     cg.set(nextCfg);

//     if (lastMove && lastMove.length === 2) {
//       cg.set({ lastMove });
//     }

//     console.log("🧩 CG APPLY =>", {
//       orientation,
//       turnColor,
//       movableColor,
//       viewOnly,
//       fenTurn: fenTurn(fen),
//       destsKeys: dests.size
//     });
//   }, [fen, orientation, turnColor, viewOnly, movable, lastMove, movableColor, dests]);

//   return <div ref={containerRef} className={className} style={{ touchAction: "none" }} />;
// }


import { useEffect, useMemo, useRef } from "react";
import { Chessground } from "chessground";
import type { Api, Config } from "chessground/api";
import type { Key } from "chessground/types";

import "chessground/assets/chessground.base.css";
import "chessground/assets/chessground.brown.css";
import "chessground/assets/chessground.cburnett.css";

type Color = "white" | "black";

export type ChessBoardViewProps = {
  className?: string;

  fen: string;
  orientation: Color;

  // ✅ نوبت فعلی (از روی FEN)
  turnColor: Color;

  // if null => user can't move
  movableColor: Color | null;

  // ✅ IMPORTANT: keep Map (Chessground expects .get())
  dests: Map<Key, Key[]>;

  onMove: (from: Key, to: Key) => void | Promise<void>;

  lastMove?: [Key, Key] | null;
  viewOnly?: boolean;
};

function fenTurn(fen: string): "w" | "b" | "?" {
  const parts = fen.trim().split(/\s+/);
  return (parts[1] as any) ?? "?";
}

export function ChessBoardView({
  className,
  fen,
  orientation,
  turnColor,
  movableColor,
  dests,
  onMove,
  lastMove = null,
  viewOnly = false
}: ChessBoardViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const cgRef = useRef<Api | null>(null);

  const movable = useMemo((): Config["movable"] => {
    if (viewOnly || !movableColor) {
      return {
        free: false,
        color: undefined,
        dests: new Map(),
        showDests: false,
        events: {}
      };
    }

    return {
      free: false,
      color: movableColor,
      dests, // ✅ Map
      showDests: true,
      events: {
        after: (from: Key, to: Key) => {
          // chessground await نمی‌کند
          void Promise.resolve(onMove(from, to));
        }
      }
    };
  }, [viewOnly, movableColor, dests, onMove]);

  // ✅ create once
  useEffect(() => {
    if (!containerRef.current) return;

    const cfg: Config = {
      fen,
      orientation,
      turnColor, // ✅ ریشه مشکل premove
      coordinates: false,
      viewOnly,
      highlight: { lastMove: true, check: true },
      animation: { enabled: true, duration: 200 },

      movable,

      // ✅ مهم: premove را خاموش کن تا طوسی/پریموو نشود
      premovable: { enabled: false },

      draggable: { enabled: !viewOnly, showGhost: true, distance: 3 },
      selectable: { enabled: !viewOnly }
    };

    cgRef.current = Chessground(containerRef.current, cfg);

    return () => {
      try {
        cgRef.current?.destroy?.();
      } catch {}
      cgRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ✅ update on every prop change
  useEffect(() => {
    const cg = cgRef.current;
    if (!cg) return;

    const nextCfg: Config = {
      fen,
      orientation,
      turnColor,
      viewOnly,
      movable,
      premovable: { enabled: false },
      draggable: { enabled: !viewOnly, showGhost: true, distance: 3 },
      selectable: { enabled: !viewOnly },
      highlight: { lastMove: true, check: true }
    };

    cg.set(nextCfg);

    if (lastMove && lastMove.length === 2) cg.set({ lastMove });

    console.log("🧩 CG APPLY =>", {
      orientation,
      turnColor,
      movableColor,
      viewOnly,
      fenTurn: fenTurn(fen),
      destsKeys: dests.size
    });
  }, [fen, orientation, turnColor, viewOnly, movable, lastMove, movableColor, dests]);

  return <div ref={containerRef} className={className} style={{ touchAction: "none" }} />;
}
