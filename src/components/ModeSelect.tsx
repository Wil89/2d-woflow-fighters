import type { GameMode } from '../types/game';

interface ModeSelectProps {
  onSelect: (mode: GameMode) => void;
  onBack: () => void;
}

export const ModeSelect = ({ onSelect, onBack }: ModeSelectProps) => {
  return (
    <div className="mode-select">
      {/* Background */}
      <div className="select-background">
        <div className="bg-pattern" />
        <div className="scanlines" />
      </div>

      <div className="select-header">
        <button className="back-button" onClick={onBack}>← BACK</button>
        <div className="title-container">
          <h1>SELECT MODE</h1>
          <div className="title-underline" />
        </div>
      </div>

      <div className="mode-grid">
        <button className="mode-card training" onClick={() => onSelect('training')}>
          <div className="card-border" />
          <div className="mode-content">
            <div className="mode-icon">🥋</div>
            <div className="mode-info">
              <h2>TRAINING</h2>
              <p>Practice combos against a passive dummy. Perfect your skills!</p>
            </div>
            <div className="mode-badge">FREE PLAY</div>
          </div>
        </button>

        <button className="mode-card vs-cpu" onClick={() => onSelect('vs-cpu')}>
          <div className="card-border" />
          <div className="mode-content">
            <div className="mode-icon">🤖</div>
            <div className="mode-info">
              <h2>VS CPU</h2>
              <p>Battle the AI! Test your skills against a computer opponent.</p>
            </div>
            <div className="mode-badge">1 PLAYER</div>
          </div>
        </button>

        <button className="mode-card online" onClick={() => onSelect('online')}>
          <div className="card-border" />
          <div className="mode-content">
            <div className="mode-icon">⚔️</div>
            <div className="mode-info">
              <h2>ONLINE PvP</h2>
              <p>Challenge your friends! Create or join a room to fight online.</p>
            </div>
            <div className="mode-badge">2 PLAYERS</div>
          </div>
        </button>
      </div>

      <div className="footer-hint">
        CHOOSE YOUR BATTLE!
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap');

        .mode-select {
          min-height: 100vh;
          height: auto;
          background: #0a0a15;
          padding: 2rem 2rem 3rem;
          display: block;
          font-family: 'Press Start 2P', monospace;
          position: relative;
          overflow: visible;
        }

        .select-background {
          position: fixed;
          inset: 0;
          pointer-events: none;
          z-index: 0;
        }

        .bg-pattern {
          position: absolute;
          inset: 0;
          background:
            radial-gradient(ellipse at 30% 30%, rgba(68, 187, 68, 0.1) 0%, transparent 40%),
            radial-gradient(ellipse at 50% 50%, rgba(68, 170, 255, 0.1) 0%, transparent 40%),
            radial-gradient(ellipse at 70% 70%, rgba(255, 102, 170, 0.1) 0%, transparent 40%);
        }

        .scanlines {
          position: absolute;
          inset: 0;
          background: repeating-linear-gradient(
            0deg,
            transparent,
            transparent 2px,
            rgba(0, 0, 0, 0.3) 2px,
            rgba(0, 0, 0, 0.3) 4px
          );
          opacity: 0.3;
        }

        .select-header {
          display: flex;
          align-items: center;
          gap: 2rem;
          margin-bottom: 2rem;
          position: relative;
          z-index: 1;
        }

        .back-button {
          padding: 0.6rem 1rem;
          font-family: 'Press Start 2P', monospace;
          font-size: 0.7rem;
          color: #fff;
          background: linear-gradient(180deg, #333 0%, #111 100%);
          border: 3px solid #555;
          cursor: pointer;
          transition: all 0.1s;
        }

        .back-button:hover {
          background: linear-gradient(180deg, #444 0%, #222 100%);
          border-color: #777;
        }

        .title-container {
          flex: 1;
          text-align: center;
        }

        .select-header h1 {
          font-size: 2rem;
          color: #ffcc00;
          text-shadow:
            3px 3px 0 #ff6600,
            6px 6px 0 #000;
          margin: 0;
        }

        .title-underline {
          height: 4px;
          background: linear-gradient(90deg, transparent, #ffcc00, #ff6600, #ffcc00, transparent);
          margin-top: 0.5rem;
        }

        .mode-grid {
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          gap: 1.5rem;
          padding: 1rem 2rem;
          position: relative;
          z-index: 1;
          max-width: 700px;
          margin: 0 auto;
          width: 100%;
        }

        .mode-card {
          position: relative;
          width: 100%;
          max-width: 600px;
          height: auto;
          min-height: 120px;
          background: linear-gradient(180deg, #1a1a2e 0%, #0d0d1a 100%);
          border: none;
          padding: 0;
          cursor: pointer;
          transition: all 0.2s;
        }

        .card-border {
          position: absolute;
          inset: 0;
          border: 4px solid #333;
          pointer-events: none;
          transition: all 0.2s;
        }

        .mode-card:hover {
          transform: translateY(-10px);
        }

        .mode-card:hover .card-border {
          border-color: #ffcc00;
          box-shadow: 0 0 30px rgba(255, 204, 0, 0.3);
        }

        .mode-card.training:hover .card-border {
          border-color: #44BB44;
          box-shadow: 0 0 30px rgba(68, 187, 68, 0.5);
        }

        .mode-card.vs-cpu:hover .card-border {
          border-color: #44AAFF;
          box-shadow: 0 0 30px rgba(68, 170, 255, 0.5);
        }

        .mode-card.online:hover .card-border {
          border-color: #FF66AA;
          box-shadow: 0 0 30px rgba(255, 102, 170, 0.5);
        }

        .mode-content {
          display: flex;
          flex-direction: row;
          align-items: center;
          justify-content: flex-start;
          height: 100%;
          padding: 1.2rem 1.5rem;
          text-align: left;
          gap: 1.5rem;
        }

        .mode-icon {
          font-size: 3rem;
          filter: drop-shadow(0 4px 8px rgba(0,0,0,0.5));
          flex-shrink: 0;
        }

        .mode-info {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .mode-card h2 {
          font-size: 1.1rem;
          color: #fff;
          margin: 0;
          text-shadow: 2px 2px 0 #000;
        }

        .mode-card.training h2 { color: #44BB44; }
        .mode-card.vs-cpu h2 { color: #44AAFF; }
        .mode-card.online h2 { color: #FF66AA; }

        .mode-divider {
          display: none;
        }

        .mode-card p {
          font-size: 0.5rem;
          color: #888;
          margin: 0;
          line-height: 1.6;
        }

        .mode-badge {
          padding: 0.4rem 0.8rem;
          font-size: 0.45rem;
          color: #000;
          background: linear-gradient(180deg, #ffcc00 0%, #ff8800 100%);
          border: 2px solid #fff;
          align-self: flex-end;
          flex-shrink: 0;
        }

        .mode-card.training .mode-badge {
          background: linear-gradient(180deg, #66dd66 0%, #44BB44 100%);
        }

        .mode-card.vs-cpu .mode-badge {
          background: linear-gradient(180deg, #66bbff 0%, #44AAFF 100%);
        }

        .mode-card.online .mode-badge {
          background: linear-gradient(180deg, #ff88bb 0%, #FF66AA 100%);
        }

        .footer-hint {
          text-align: center;
          font-size: 0.8rem;
          color: #ffcc00;
          animation: blink 1s step-end infinite;
          position: relative;
          z-index: 1;
        }

        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        /* CRT effect */
        .mode-select::after {
          content: '';
          position: fixed;
          inset: 0;
          background: radial-gradient(ellipse at center, transparent 0%, rgba(0,0,0,0.4) 100%);
          pointer-events: none;
          z-index: 100;
        }

        /* Responsive styles */
        @media (max-width: 600px) {
          .mode-select {
            padding: 1rem 1rem 3rem;
          }

          .select-header {
            flex-direction: column;
            gap: 0.5rem;
            margin-bottom: 1rem;
          }

          .select-header h1 {
            font-size: 1.2rem;
          }

          .back-button {
            align-self: flex-start;
          }

          .mode-grid {
            gap: 1rem;
            padding: 0.5rem;
          }

          .mode-card {
            min-height: 100px;
          }

          .mode-content {
            padding: 1rem;
            gap: 1rem;
          }

          .mode-icon {
            font-size: 2rem;
          }

          .mode-card h2 {
            font-size: 0.8rem;
          }

          .mode-card p {
            font-size: 0.4rem;
            line-height: 1.5;
          }

          .mode-badge {
            font-size: 0.35rem;
            padding: 0.3rem 0.5rem;
          }

          .footer-hint {
            font-size: 0.6rem;
          }
        }

        @media (max-width: 400px) {
          .mode-content {
            flex-direction: column;
            text-align: center;
          }

          .mode-info {
            align-items: center;
          }

          .mode-badge {
            align-self: center;
          }
        }
      `}</style>
    </div>
  );
};
