import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Home } from '../pages/Home';
import { ChessBoard } from '../features/chess/ChessBoard';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/play-with-friend" element={<ChessBoard />} />
        <Route path="/play-with-bot" element={<ChessBoard />} />
      </Routes>
    </Router>
  );
}

export default App;