interface MainMenuProps {
  onStart: () => void;
}

export const MainMenu = ({ onStart }: MainMenuProps) => {
  return (
    <div className="main-menu">
      <div className="menu-background">
        {/* Animated background elements */}
        <div className="bg-gradient" />
        <div className="scanlines" />
        <div className="energy-lines">
          {[...Array(8)].map((_, i) => (
            <div
              key={i}
              className="energy-line"
              style={{
                left: `${10 + i * 12}%`,
                animationDelay: `${i * 0.15}s`,
              }}
            />
          ))}
        </div>
        <div className="sparks">
          {[...Array(15)].map((_, i) => (
            <div
              key={i}
              className="spark"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 3}s`,
              }}
            />
          ))}
        </div>
      </div>

      <div className="menu-content">
        {/* Main Title */}
        <div className="title-container">
          <div className="title-woflow">WOFLOW</div>
          <div className="title-main">
            <span className="street">STREET</span>
            <span className="fighters">FIGHTERS</span>
          </div>
          <div className="title-two">II</div>
          <div className="title-subtitle">TURBO EDITION</div>
        </div>

        {/* Decorative fight text */}
        <div className="fight-badge">
          <span>FIGHT!</span>
        </div>

        <button className="start-button" onClick={onStart}>
          <span className="button-inner">
            <span className="button-text">PRESS START</span>
          </span>
        </button>

        <div className="insert-coin">
          INSERT COIN
          <span className="blink">_</span>
        </div>

        <div className="controls-hint">
          <div className="control-row">
            <span className="key">← ↑ ↓ →</span>
            <span className="action">MOVE</span>
          </div>
          <div className="control-row">
            <span className="key">F</span>
            <span className="action">PUNCH</span>
          </div>
          <div className="control-row">
            <span className="key">G</span>
            <span className="action">KICK</span>
          </div>
          <div className="control-row">
            <span className="key">H</span>
            <span className="action">SPECIAL</span>
          </div>
          <div className="control-row">
            <span className="key">SHIFT</span>
            <span className="action">BLOCK</span>
          </div>
        </div>

        <div className="copyright">
          © 2024 WOFLOW CORPORATION
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap');

        .main-menu {
          position: relative;
          width: 100%;
          height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          background: #000;
          font-family: 'Press Start 2P', monospace;
        }

        .menu-background {
          position: absolute;
          inset: 0;
          overflow: hidden;
        }

        .bg-gradient {
          position: absolute;
          inset: 0;
          background:
            radial-gradient(ellipse at 50% 0%, #1a0a2e 0%, transparent 50%),
            radial-gradient(ellipse at 0% 100%, #2a1a0a 0%, transparent 40%),
            radial-gradient(ellipse at 100% 100%, #0a1a2a 0%, transparent 40%),
            linear-gradient(180deg, #0a0a15 0%, #151525 50%, #0a0a15 100%);
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
          pointer-events: none;
          opacity: 0.5;
        }

        .energy-lines {
          position: absolute;
          inset: 0;
          overflow: hidden;
        }

        .energy-line {
          position: absolute;
          width: 3px;
          height: 100%;
          background: linear-gradient(
            180deg,
            transparent 0%,
            rgba(255, 200, 0, 0.8) 50%,
            transparent 100%
          );
          opacity: 0;
          animation: energyPulse 2s ease-in-out infinite;
        }

        @keyframes energyPulse {
          0%, 100% { opacity: 0; transform: scaleY(0); }
          50% { opacity: 0.3; transform: scaleY(1); }
        }

        .sparks {
          position: absolute;
          inset: 0;
        }

        .spark {
          position: absolute;
          width: 4px;
          height: 4px;
          background: #fff;
          border-radius: 50%;
          box-shadow: 0 0 10px #ff8800, 0 0 20px #ff4400;
          animation: sparkle 2s ease-in-out infinite;
        }

        @keyframes sparkle {
          0%, 100% { opacity: 0; transform: scale(0); }
          50% { opacity: 1; transform: scale(1); }
        }

        .menu-content {
          position: relative;
          z-index: 1;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1.5rem;
        }

        .title-container {
          position: relative;
          margin-bottom: 1rem;
        }

        .title-woflow {
          font-size: 1.2rem;
          color: #00ccff;
          letter-spacing: 0.8em;
          text-shadow:
            0 0 10px #00ccff,
            0 0 20px #0088cc,
            2px 2px 0 #000;
          margin-bottom: 0.5rem;
          animation: glowPulse 2s ease-in-out infinite;
        }

        @keyframes glowPulse {
          0%, 100% { text-shadow: 0 0 10px #00ccff, 0 0 20px #0088cc, 2px 2px 0 #000; }
          50% { text-shadow: 0 0 20px #00ccff, 0 0 40px #0088cc, 2px 2px 0 #000; }
        }

        .title-main {
          display: flex;
          flex-direction: column;
          align-items: center;
          line-height: 1;
        }

        .street {
          font-size: 2.5rem;
          font-weight: 900;
          font-style: italic;
          color: #fff;
          letter-spacing: 0.15em;
          text-shadow:
            4px 4px 0 #ff6600,
            8px 8px 0 #cc3300,
            12px 12px 0 #000,
            0 0 30px rgba(255, 102, 0, 0.5);
          transform: skewX(-5deg);
        }

        .fighters {
          font-size: 3.5rem;
          font-weight: 900;
          font-style: italic;
          background: linear-gradient(180deg, #ffee00 0%, #ff8800 50%, #ff4400 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          filter: drop-shadow(4px 4px 0 #000) drop-shadow(6px 6px 0 rgba(0,0,0,0.5));
          letter-spacing: 0.05em;
          transform: skewX(-5deg);
          animation: titlePulse 3s ease-in-out infinite;
        }

        @keyframes titlePulse {
          0%, 100% { filter: drop-shadow(4px 4px 0 #000) drop-shadow(6px 6px 0 rgba(0,0,0,0.5)) brightness(1); }
          50% { filter: drop-shadow(4px 4px 0 #000) drop-shadow(6px 6px 0 rgba(0,0,0,0.5)) brightness(1.2); }
        }

        .title-two {
          position: absolute;
          right: -60px;
          top: 50%;
          transform: translateY(-50%) skewX(-10deg);
          font-size: 5rem;
          font-weight: 900;
          font-style: italic;
          color: #ff0000;
          text-shadow:
            4px 4px 0 #880000,
            8px 8px 0 #000,
            0 0 40px rgba(255, 0, 0, 0.8);
          animation: twoGlow 1.5s ease-in-out infinite;
        }

        @keyframes twoGlow {
          0%, 100% {
            text-shadow: 4px 4px 0 #880000, 8px 8px 0 #000, 0 0 40px rgba(255, 0, 0, 0.8);
          }
          50% {
            text-shadow: 4px 4px 0 #880000, 8px 8px 0 #000, 0 0 60px rgba(255, 0, 0, 1), 0 0 80px rgba(255, 100, 0, 0.5);
          }
        }

        .title-subtitle {
          font-size: 0.7rem;
          color: #88ff88;
          letter-spacing: 0.5em;
          margin-top: 0.5rem;
          text-shadow: 0 0 10px #00ff00, 2px 2px 0 #000;
        }

        .fight-badge {
          background: linear-gradient(180deg, #ff4444 0%, #cc0000 100%);
          padding: 0.5rem 2rem;
          border: 4px solid #ffcc00;
          transform: skewX(-10deg) rotate(-3deg);
          box-shadow:
            4px 4px 0 #000,
            0 0 20px rgba(255, 68, 68, 0.5);
        }

        .fight-badge span {
          display: block;
          transform: skewX(10deg);
          font-size: 1.2rem;
          color: #fff;
          text-shadow: 2px 2px 0 #000;
          letter-spacing: 0.2em;
        }

        .start-button {
          position: relative;
          padding: 0;
          background: none;
          border: none;
          cursor: pointer;
          margin-top: 1rem;
        }

        .button-inner {
          display: block;
          padding: 1rem 3rem;
          background: linear-gradient(180deg, #ffcc00 0%, #ff8800 50%, #cc4400 100%);
          border: 4px solid #fff;
          border-radius: 0;
          transform: skewX(-5deg);
          box-shadow:
            6px 6px 0 #000,
            0 0 30px rgba(255, 136, 0, 0.5);
          transition: all 0.1s ease;
        }

        .start-button:hover .button-inner {
          transform: skewX(-5deg) translateY(-4px);
          box-shadow:
            8px 10px 0 #000,
            0 0 50px rgba(255, 136, 0, 0.8);
          background: linear-gradient(180deg, #ffdd00 0%, #ffaa00 50%, #ff6600 100%);
        }

        .start-button:active .button-inner {
          transform: skewX(-5deg) translateY(2px);
          box-shadow:
            2px 2px 0 #000,
            0 0 20px rgba(255, 136, 0, 0.3);
        }

        .button-text {
          display: block;
          transform: skewX(5deg);
          font-family: 'Press Start 2P', monospace;
          font-size: 1rem;
          color: #000;
          text-shadow: none;
          letter-spacing: 0.1em;
        }

        .insert-coin {
          font-size: 0.8rem;
          color: #ffcc00;
          animation: blink 1s step-end infinite;
        }

        .blink {
          animation: cursorBlink 0.5s step-end infinite;
        }

        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        @keyframes cursorBlink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }

        .controls-hint {
          display: flex;
          gap: 2rem;
          margin-top: 1rem;
        }

        .control-row {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.3rem;
        }

        .key {
          font-size: 0.6rem;
          color: #fff;
          background: linear-gradient(180deg, #444 0%, #222 100%);
          padding: 0.4rem 0.6rem;
          border: 2px solid #666;
          border-radius: 4px;
          box-shadow: 0 3px 0 #000;
        }

        .action {
          font-size: 0.5rem;
          color: #888;
        }

        .copyright {
          position: absolute;
          bottom: -80px;
          font-size: 0.5rem;
          color: #444;
          letter-spacing: 0.2em;
        }

        /* CRT screen effect */
        .main-menu::before {
          content: '';
          position: absolute;
          inset: 0;
          background: radial-gradient(
            ellipse at center,
            transparent 0%,
            rgba(0, 0, 0, 0.3) 90%,
            rgba(0, 0, 0, 0.8) 100%
          );
          pointer-events: none;
          z-index: 10;
        }

        /* Chromatic aberration effect on title */
        .title-main::before {
          content: '';
          position: absolute;
          inset: 0;
          background: inherit;
          filter: blur(0);
          opacity: 0.5;
          transform: translateX(-2px);
          mix-blend-mode: screen;
        }

        /* Responsive styles */
        @media (max-width: 768px) {
          .title-woflow {
            font-size: 0.9rem;
            letter-spacing: 0.5em;
          }

          .street {
            font-size: 1.8rem;
          }

          .fighters {
            font-size: 2.5rem;
          }

          .title-two {
            font-size: 3.5rem;
            right: -40px;
          }

          .title-subtitle {
            font-size: 0.5rem;
          }

          .fight-badge span {
            font-size: 0.9rem;
          }

          .button-inner {
            padding: 0.8rem 2rem;
          }

          .button-text {
            font-size: 0.8rem;
          }

          .controls-hint {
            gap: 1rem;
          }

          .key {
            font-size: 0.5rem;
            padding: 0.3rem 0.5rem;
          }

          .action {
            font-size: 0.4rem;
          }
        }

        @media (max-width: 500px) {
          .menu-content {
            gap: 1rem;
          }

          .title-woflow {
            font-size: 0.7rem;
            letter-spacing: 0.3em;
          }

          .street {
            font-size: 1.3rem;
          }

          .fighters {
            font-size: 1.8rem;
          }

          .title-two {
            font-size: 2.5rem;
            right: -25px;
          }

          .title-subtitle {
            font-size: 0.4rem;
            letter-spacing: 0.3em;
          }

          .fight-badge {
            padding: 0.4rem 1.5rem;
          }

          .fight-badge span {
            font-size: 0.8rem;
          }

          .button-inner {
            padding: 0.7rem 1.5rem;
          }

          .button-text {
            font-size: 0.7rem;
          }

          .insert-coin {
            font-size: 0.6rem;
          }

          .controls-hint {
            flex-wrap: wrap;
            justify-content: center;
            gap: 0.8rem;
          }

          .copyright {
            font-size: 0.4rem;
            bottom: -60px;
          }
        }

        @media (max-width: 350px) {
          .street {
            font-size: 1.1rem;
          }

          .fighters {
            font-size: 1.5rem;
          }

          .title-two {
            font-size: 2rem;
            right: -20px;
          }
        }
      `}</style>
    </div>
  );
};
