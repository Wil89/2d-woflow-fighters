import { useState } from 'react';
import type { CharacterData } from '../types/game';
import { characters } from '../data/gameData';

interface CharacterSelectProps {
  onSelect: (character: CharacterData) => void;
  onBack: () => void;
}

export const CharacterSelect = ({ onSelect, onBack }: CharacterSelectProps) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const displayIndex = hoveredIndex ?? selectedIndex;
  const selectedCharacter = characters[displayIndex];

  return (
    <div className="character-select">
      <div className="select-header">
        <button className="back-button" onClick={onBack}>← BACK</button>
        <h1>SELECT YOUR FIGHTER</h1>
      </div>

      <div className="select-content">
        <div className="character-preview">
          <div
            className="preview-fighter"
            style={{
              background: `linear-gradient(135deg, ${selectedCharacter.color}, ${selectedCharacter.secondaryColor})`,
            }}
          >
            <img
              src={selectedCharacter.faceImage}
              alt={selectedCharacter.name}
              className="fighter-face"
            />
          </div>

          <div className="preview-info">
            <h2 className="character-name">{selectedCharacter.name}</h2>
            <p className="character-specialty">{selectedCharacter.specialty}</p>
            <p className="character-description">{selectedCharacter.description}</p>

            <div className="stats">
              <div className="stat">
                <span className="stat-label">POWER</span>
                <div className="stat-bar">
                  <div
                    className="stat-fill power"
                    style={{ width: `${selectedCharacter.stats.power * 10}%` }}
                  />
                </div>
              </div>
              <div className="stat">
                <span className="stat-label">SPEED</span>
                <div className="stat-bar">
                  <div
                    className="stat-fill speed"
                    style={{ width: `${selectedCharacter.stats.speed * 10}%` }}
                  />
                </div>
              </div>
              <div className="stat">
                <span className="stat-label">DEFENSE</span>
                <div className="stat-bar">
                  <div
                    className="stat-fill defense"
                    style={{ width: `${selectedCharacter.stats.defense * 10}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="character-grid">
          {characters.map((char, index) => (
            <button
              key={char.id}
              className={`character-card ${selectedIndex === index ? 'selected' : ''}`}
              onClick={() => {
                setSelectedIndex(index);
              }}
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
              onDoubleClick={() => onSelect(char)}
            >
              <div
                className="card-avatar"
                style={{
                  background: `linear-gradient(135deg, ${char.color}, ${char.secondaryColor})`,
                }}
              >
                <img
                  src={char.faceImage}
                  alt={char.name}
                  className="card-face"
                />
              </div>
              <span className="card-name">{char.name}</span>
            </button>
          ))}
        </div>
      </div>

      <button
        className="confirm-button"
        onClick={() => onSelect(characters[selectedIndex])}
      >
        SELECT {selectedCharacter.name}
      </button>

      <style>{`
        .character-select {
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
          margin-bottom: 2rem;
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

        .select-content {
          flex: 1;
          display: flex;
          gap: 3rem;
          align-items: flex-start;
        }

        .character-preview {
          flex: 1;
          display: flex;
          gap: 2rem;
          background: rgba(0,0,0,0.3);
          border-radius: 20px;
          padding: 2rem;
          border: 3px solid rgba(255,255,255,0.1);
        }

        .preview-fighter {
          width: 200px;
          height: 280px;
          border-radius: 15px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 10px 30px rgba(0,0,0,0.5);
          animation: fighterIdle 1s ease-in-out infinite;
        }

        @keyframes fighterIdle {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-5px); }
        }

        .fighter-face {
          width: 180px;
          height: 180px;
          object-fit: cover;
          border-radius: 50%;
          border: 4px solid rgba(0,0,0,0.3);
        }

        .preview-info {
          flex: 1;
        }

        .character-name {
          font-size: 2.5rem;
          color: #fff;
          margin: 0 0 0.5rem 0;
          text-shadow: 2px 2px 0 #000;
        }

        .character-specialty {
          font-size: 1.2rem;
          color: #ffdd00;
          margin: 0 0 1rem 0;
          text-transform: uppercase;
          letter-spacing: 0.1em;
        }

        .character-description {
          color: rgba(255,255,255,0.7);
          margin: 0 0 2rem 0;
          font-size: 1.1rem;
        }

        .stats {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .stat {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .stat-label {
          width: 80px;
          font-size: 0.9rem;
          color: rgba(255,255,255,0.7);
          font-weight: 700;
        }

        .stat-bar {
          flex: 1;
          height: 12px;
          background: rgba(0,0,0,0.5);
          border-radius: 6px;
          overflow: hidden;
        }

        .stat-fill {
          height: 100%;
          border-radius: 6px;
          transition: width 0.3s ease;
        }

        .stat-fill.power {
          background: linear-gradient(90deg, #ff4444, #ff8800);
        }

        .stat-fill.speed {
          background: linear-gradient(90deg, #44aaff, #88ddff);
        }

        .stat-fill.defense {
          background: linear-gradient(90deg, #44bb44, #88dd44);
        }

        .character-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 1rem;
          width: 420px;
        }

        .character-card {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.5rem;
          padding: 1rem;
          background: rgba(0,0,0,0.3);
          border: 3px solid rgba(255,255,255,0.1);
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .character-card:hover {
          background: rgba(255,255,255,0.1);
          transform: translateY(-5px);
        }

        .character-card.selected {
          border-color: #ffdd00;
          box-shadow: 0 0 20px rgba(255,221,0,0.3);
        }

        .card-avatar {
          width: 80px;
          height: 80px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }

        .card-face {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .card-name {
          font-size: 0.8rem;
          color: #fff;
          font-weight: 700;
        }

        .confirm-button {
          align-self: center;
          margin-top: 2rem;
          padding: 1.2rem 3rem;
          font-size: 1.5rem;
          font-weight: 800;
          color: #fff;
          background: linear-gradient(180deg, #44bb44 0%, #339933 100%);
          border: none;
          border-radius: 50px;
          cursor: pointer;
          box-shadow: 0 5px 0 #226622, 0 8px 15px rgba(0,0,0,0.4);
          transition: all 0.2s;
        }

        .confirm-button:hover {
          transform: translateY(-3px);
          box-shadow: 0 8px 0 #226622, 0 12px 20px rgba(0,0,0,0.5);
        }

        .confirm-button:active {
          transform: translateY(2px);
          box-shadow: 0 2px 0 #226622, 0 4px 8px rgba(0,0,0,0.3);
        }
      `}</style>
    </div>
  );
};
