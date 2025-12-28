// src/types/stockfish.d.ts
declare module 'stockfish' {
  export default function Stockfish(): Worker;
}

declare global {
  interface Window {
    Stockfish?: any;
  }
}