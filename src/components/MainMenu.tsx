interface MainMenuProps {
  onStart: () => void;
}

export const MainMenu = ({ onStart }: MainMenuProps) => {
  return (
    <div className="main-menu">
      <div className="menu-background">
        <div className="floating-shapes">
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="shape"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 5}s`,
                animationDuration: `${3 + Math.random() * 4}s`,
              }}
            />
          ))}
        </div>
      </div>

      <div className="menu-content">
        <h1 className="game-title">
          <span className="title-letter" style={{ animationDelay: '0s' }}>S</span>
          <span className="title-letter" style={{ animationDelay: '0.1s' }}>T</span>
          <span className="title-letter" style={{ animationDelay: '0.2s' }}>R</span>
          <span className="title-letter" style={{ animationDelay: '0.3s' }}>E</span>
          <span className="title-letter" style={{ animationDelay: '0.4s' }}>E</span>
          <span className="title-letter" style={{ animationDelay: '0.5s' }}>T</span>
          <span className="title-space"> </span>
          <span className="title-letter highlight" style={{ animationDelay: '0.7s' }}>F</span>
          <span className="title-letter highlight" style={{ animationDelay: '0.8s' }}>U</span>
          <span className="title-letter highlight" style={{ animationDelay: '0.9s' }}>R</span>
          <span className="title-letter highlight" style={{ animationDelay: '1.0s' }}>Y</span>
        </h1>

        <p className="subtitle">The Ultimate Showdown!</p>

        <button className="start-button" onClick={onStart}>
          <span className="button-text">START GAME</span>
          <span className="button-shine" />
        </button>

        <div className="controls-hint">
          <p>Player Controls:</p>
          <p>WASD - Move & Jump | F - Punch | G - Kick | S - Block</p>
        </div>
      </div>

      <style>{`
        .main-menu {
          position: relative;
          width: 100%;
          height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
        }

        .menu-background {
          position: absolute;
          inset: 0;
          overflow: hidden;
        }

        .floating-shapes {
          position: absolute;
          inset: 0;
        }

        .shape {
          position: absolute;
          width: 20px;
          height: 20px;
          background: linear-gradient(45deg, #ff4444, #ff8800);
          border-radius: 50%;
          opacity: 0.3;
          animation: float 5s ease-in-out infinite;
        }

        .shape:nth-child(even) {
          background: linear-gradient(45deg, #44aaff, #88ddff);
          border-radius: 4px;
          transform: rotate(45deg);
        }

        .shape:nth-child(3n) {
          background: linear-gradient(45deg, #ffdd00, #ffff88);
          clip-path: polygon(50% 0%, 100% 100%, 0% 100%);
          border-radius: 0;
        }

        @keyframes float {
          0%, 100% {
            transform: translateY(0) rotate(0deg);
          }
          50% {
            transform: translateY(-30px) rotate(180deg);
          }
        }

        .menu-content {
          position: relative;
          z-index: 1;
          text-align: center;
        }

        .game-title {
          font-size: 5rem;
          font-weight: 900;
          margin-bottom: 1rem;
          text-shadow:
            4px 4px 0 #000,
            8px 8px 0 rgba(0,0,0,0.3),
            0 0 40px rgba(255,68,68,0.5);
        }

        .title-letter {
          display: inline-block;
          color: #fff;
          animation: bounce 0.5s ease-out forwards;
          opacity: 0;
          transform: translateY(-50px);
        }

        .title-letter.highlight {
          color: #ff4444;
          text-shadow:
            4px 4px 0 #880000,
            0 0 30px rgba(255,68,68,0.8);
        }

        .title-space {
          display: inline-block;
          width: 30px;
        }

        @keyframes bounce {
          0% {
            opacity: 0;
            transform: translateY(-50px) scale(1.5);
          }
          60% {
            opacity: 1;
            transform: translateY(10px) scale(0.9);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        .subtitle {
          font-size: 1.5rem;
          color: #88ddff;
          text-transform: uppercase;
          letter-spacing: 0.5em;
          margin-bottom: 3rem;
          animation: pulse 2s ease-in-out infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 0.7; }
          50% { opacity: 1; }
        }

        .start-button {
          position: relative;
          padding: 1.5rem 4rem;
          font-size: 1.8rem;
          font-weight: 800;
          color: #fff;
          background: linear-gradient(180deg, #ff6b6b 0%, #ee4444 50%, #cc2222 100%);
          border: none;
          border-radius: 60px;
          cursor: pointer;
          overflow: hidden;
          transition: all 0.3s ease;
          box-shadow:
            0 6px 0 #990000,
            0 10px 20px rgba(0,0,0,0.4);
          animation: buttonPulse 1.5s ease-in-out infinite;
        }

        .start-button:hover {
          transform: translateY(-4px);
          box-shadow:
            0 10px 0 #990000,
            0 15px 30px rgba(0,0,0,0.5);
        }

        .start-button:active {
          transform: translateY(2px);
          box-shadow:
            0 2px 0 #990000,
            0 5px 10px rgba(0,0,0,0.3);
        }

        @keyframes buttonPulse {
          0%, 100% { box-shadow: 0 6px 0 #990000, 0 10px 20px rgba(0,0,0,0.4), 0 0 0 0 rgba(255,107,107,0.7); }
          50% { box-shadow: 0 6px 0 #990000, 0 10px 20px rgba(0,0,0,0.4), 0 0 0 15px rgba(255,107,107,0); }
        }

        .button-text {
          position: relative;
          z-index: 1;
          text-shadow: 2px 2px 0 rgba(0,0,0,0.3);
        }

        .button-shine {
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(
            90deg,
            transparent,
            rgba(255,255,255,0.3),
            transparent
          );
          animation: shine 3s infinite;
        }

        @keyframes shine {
          0% { left: -100%; }
          30%, 100% { left: 100%; }
        }

        .controls-hint {
          margin-top: 3rem;
          color: rgba(255,255,255,0.6);
          font-size: 0.9rem;
        }

        .controls-hint p {
          margin: 0.5rem 0;
        }
      `}</style>
    </div>
  );
};
