// // utils/playerUtils.ts
// export const getPlayerId = (): string => {
//   let id = localStorage.getItem("playerId");
//   if (!id) {
//     // Generate a unique ID
//     id = 'player_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
//     localStorage.setItem("playerId", id);
//   }
//   return id;
// };

// export const getPlayerName = (): string => {
//   return localStorage.getItem('player_name') || `Player_${Math.random().toString(36).substr(2, 4)}`;
// };  

// utils/playerUtils.ts
export function getPlayerId() {
  let id = sessionStorage.getItem('player_id');
  
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem('player_id', id);
  }

  return id;
}

export function getPlayerName() {
  let name = sessionStorage.getItem('player_name');

  if (!name) {
    name = `Player_${Math.floor(Math.random() * 1000)}`;
    sessionStorage.setItem('player_name', name);
  }

  return name;
}
