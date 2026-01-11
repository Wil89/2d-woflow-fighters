import type { GameMode } from '../types/game';

interface ModeSelectProps {
  onSelect: (mode: GameMode) => void;
  onBack: () => void;
}

export const ModeSelect = ({ onSelect, onBack }: ModeSelectProps) => {
  return (
    <div className="mode-select">
      <div className="select-header">
        <button className="back-button" onClick={onBack}>← BACK</button>
        <h1>SELECT MODE</h1>
      </div>

      <div className="mode-grid">
        <button className="mode-card training" onClick={() => onSelect('training')}>
          <div className="mode-icon">🎯</div>
          <h2>TRAINING</h2>
          <p>Practice your moves against a passive opponent that won't fight back</p>
        </button>

        <button className="mode-card vs-cpu" onClick={() => onSelect('vs-cpu')}>
          <div className="mode-icon">🤖</div>
          <h2>VS CPU</h2>
          <p>Battle against an AI opponent in single player mode</p>
        </button>

        <button className="mode-card online" onClick={() => onSelect('online')}>
          <div className="mode-icon">🌐</div>
          <h2>ONLINE PvP</h2>
          <p>Fight against a friend online with room codes</p>
        </button>
      </div>

      <style>{`
        .mode-select {
          min-height: 100vh;
          background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
          padding: 2rem;
          display: flex;
          flex-direction: column;
        }

        .select-header {
          display: flex;
          align-items: center;
          gap: 2rem;
          margin-bottom: 3rem;
        }

        .back-button {
          padding: 0.8rem 1.5rem;
          font-size: 1rem;
          font-weight: 700;
          color: #fff;
          background: rgba(255,255,255,0.1);
          border: 2px solid rgba(255,255,255,0.3);
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .back-button:hover {
          background: rgba(255,255,255,0.2);
        }

        .select-header h1 {
          font-size: 2.5rem;
          color: #fff;
          text-shadow: 3px 3px 0 #000;
          flex: 1;
          text-align: center;
        }

        .mode-grid {
          flex: 1;
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 2rem;
          padding: 2rem;
        }

        .mode-card {
          width: 280px;
          height: 350px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 1rem;
          padding: 2rem;
          background: rgba(0,0,0,0.4);
          border: 4px solid rgba(255,255,255,0.2);
          border-radius: 20px;
          cursor: pointer;
          transition: all 0.3s;
          text-align: center;
        }

        .mode-card:hover {
          transform: translateY(-10px) scale(1.02);
          border-color: rgba(255,255,255,0.5);
        }

        .mode-card.training:hover {
          background: rgba(68, 187, 68, 0.3);
          border-color: #44BB44;
          box-shadow: 0 10px 40px rgba(68, 187, 68, 0.4);
        }

        .mode-card.vs-cpu:hover {
          background: rgba(68, 170, 255, 0.3);
          border-color: #44AAFF;
          box-shadow: 0 10px 40px rgba(68, 170, 255, 0.4);
        }

        .mode-card.online:hover {
          background: rgba(255, 102, 170, 0.3);
          border-color: #FF66AA;
          box-shadow: 0 10px 40px rgba(255, 102, 170, 0.4);
        }

        .mode-icon {
          font-size: 5rem;
          margin-bottom: 0.5rem;
        }

        .mode-card h2 {
          font-size: 1.8rem;
          color: #fff;
          margin: 0;
          text-shadow: 2px 2px 0 #000;
        }

        .mode-card p {
          font-size: 1rem;
          color: rgba(255,255,255,0.7);
          margin: 0;
          line-height: 1.4;
        }

        .mode-card.training h2 { color: #44BB44; }
        .mode-card.vs-cpu h2 { color: #44AAFF; }
        .mode-card.online h2 { color: #FF66AA; }
      `}</style>
    </div>
  );
};
