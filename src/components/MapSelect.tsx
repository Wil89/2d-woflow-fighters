import { useState } from 'react';
import type { MapData, CharacterData } from '../types/game';
import { maps } from '../data/gameData';

interface MapSelectProps {
  selectedCharacter: CharacterData;
  onSelect: (map: MapData) => void;
  onBack: () => void;
}

export const MapSelect = ({ selectedCharacter, onSelect, onBack }: MapSelectProps) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  return (
    <div className="map-select">
      {/* Background */}
      <div className="select-background">
        <div className="bg-pattern" />
        <div className="scanlines" />
      </div>

      <div className="select-header">
        <button className="back-button" onClick={onBack}>← BACK</button>
        <div className="title-container">
          <h1>SELECT ARENA</h1>
          <div className="title-underline" />
        </div>
        <div className="selected-fighter">
          <img src={selectedCharacter.faceImage} alt={selectedCharacter.name} className="fighter-avatar" />
          <span>{selectedCharacter.name}</span>
        </div>
      </div>

      <div className="map-grid">
        {maps.map((map, index) => (
          <button
            key={map.id}
            className={`map-card ${selectedIndex === index ? 'selected' : ''}`}
            onClick={() => setSelectedIndex(index)}
            onDoubleClick={() => onSelect(map)}
          >
            <div className="card-frame">
              <div
                className="map-preview"
                style={{ backgroundImage: `url(${map.image})` }}
              >
                <div className="map-overlay" />
                {selectedIndex === index && <div className="select-indicator">▶</div>}
              </div>
              <div className="map-info">
                <h2>{map.name}</h2>
                <p>{map.ambience}</p>
              </div>
            </div>
          </button>
        ))}
      </div>

      <button
        className="confirm-button"
        onClick={() => onSelect(maps[selectedIndex])}
      >
        <span className="button-text">FIGHT IN {maps[selectedIndex].name.toUpperCase()}!</span>
      </button>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap');

        .map-select {
          min-height: 100vh;
          background: #0a0a15;
          padding: 2rem;
          display: flex;
          flex-direction: column;
          font-family: 'Press Start 2P', monospace;
          position: relative;
          overflow-x: hidden;
          overflow-y: auto;
        }

        .select-background {
          position: absolute;
          inset: 0;
          pointer-events: none;
        }

        .bg-pattern {
          position: absolute;
          inset: 0;
          background:
            radial-gradient(ellipse at 50% 50%, rgba(255, 100, 0, 0.1) 0%, transparent 50%);
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
          font-size: 1.8rem;
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

        .selected-fighter {
          display: flex;
          align-items: center;
          gap: 0.8rem;
          padding: 0.5rem 1rem;
          background: linear-gradient(180deg, #1a1a2e 0%, #0d0d1a 100%);
          border: 3px solid #ffcc00;
          color: #fff;
          font-size: 0.7rem;
        }

        .fighter-avatar {
          width: 40px;
          height: 40px;
          object-fit: cover;
          border: 2px solid #333;
        }

        .map-grid {
          flex: 1;
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 1.5rem;
          max-width: 900px;
          margin: 0 auto;
          width: 100%;
          position: relative;
          z-index: 1;
        }

        .map-card {
          border: none;
          background: none;
          padding: 0;
          cursor: pointer;
          transition: all 0.2s;
        }

        .map-card:hover {
          transform: translateY(-5px);
        }

        .card-frame {
          background: #111;
          border: 4px solid #333;
          transition: all 0.2s;
        }

        .map-card:hover .card-frame {
          border-color: #888;
        }

        .map-card.selected .card-frame {
          border-color: #ffcc00;
          box-shadow: 0 0 30px rgba(255, 204, 0, 0.4);
        }

        .map-preview {
          position: relative;
          width: 100%;
          height: 180px;
          background-size: cover;
          background-position: center;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .map-overlay {
          position: absolute;
          inset: 0;
          background: linear-gradient(to top, rgba(0,0,0,0.9) 0%, transparent 30%);
        }

        .select-indicator {
          position: absolute;
          font-size: 2rem;
          color: #ffcc00;
          text-shadow: 0 0 20px #ffcc00;
          animation: pulse 0.5s ease-in-out infinite;
        }

        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.2); opacity: 0.8; }
        }

        .map-info {
          padding: 1rem;
          background: linear-gradient(180deg, #1a1a2e 0%, #111 100%);
        }

        .map-info h2 {
          margin: 0 0 0.5rem 0;
          font-size: 0.9rem;
          color: #fff;
          text-shadow: 2px 2px 0 #000;
        }

        .map-info p {
          margin: 0;
          color: #888;
          font-size: 0.5rem;
        }

        .confirm-button {
          align-self: center;
          margin-top: 1.5rem;
          padding: 0;
          background: none;
          border: none;
          cursor: pointer;
          position: relative;
          z-index: 1;
        }

        .confirm-button .button-text {
          display: block;
          padding: 1rem 2rem;
          font-family: 'Press Start 2P', monospace;
          font-size: 0.8rem;
          color: #000;
          background: linear-gradient(180deg, #ff6666 0%, #cc0000 50%, #990000 100%);
          border: 4px solid #fff;
          box-shadow: 6px 6px 0 #000;
          transition: all 0.1s;
        }

        .confirm-button:hover .button-text {
          transform: translateY(-3px);
          box-shadow: 9px 9px 0 #000;
          background: linear-gradient(180deg, #ff8888 0%, #ee2222 50%, #aa0000 100%);
          color: #fff;
        }

        .confirm-button:active .button-text {
          transform: translateY(2px);
          box-shadow: 2px 2px 0 #000;
        }

        /* CRT effect */
        .map-select::after {
          content: '';
          position: absolute;
          inset: 0;
          background: radial-gradient(ellipse at center, transparent 0%, rgba(0,0,0,0.4) 100%);
          pointer-events: none;
          z-index: 100;
        }

        /* Responsive styles */
        @media (max-width: 800px) {
          .map-grid {
            grid-template-columns: 1fr;
            max-width: 500px;
          }
        }

        @media (max-width: 600px) {
          .map-select {
            padding: 1rem;
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

          .selected-fighter {
            align-self: center;
            font-size: 0.6rem;
          }

          .fighter-avatar {
            width: 32px;
            height: 32px;
          }

          .map-grid {
            gap: 1rem;
          }

          .map-preview {
            height: 140px;
          }

          .map-info h2 {
            font-size: 0.7rem;
          }

          .map-info p {
            font-size: 0.4rem;
          }

          .confirm-button .button-text {
            padding: 0.8rem 1.5rem;
            font-size: 0.6rem;
          }
        }

        @media (max-width: 400px) {
          .map-preview {
            height: 120px;
          }

          .map-info {
            padding: 0.8rem;
          }
        }
      `}</style>
    </div>
  );
};
