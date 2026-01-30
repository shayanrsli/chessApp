
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
