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
      <div className="select-header">
        <button className="back-button" onClick={onBack}>← BACK</button>
        <h1>SELECT ARENA</h1>
        <div className="selected-fighter">
          <div
            className="fighter-badge"
            style={{
              background: `linear-gradient(135deg, ${selectedCharacter.color}, ${selectedCharacter.secondaryColor})`,
            }}
          />
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
            <div
              className="map-preview"
              style={{ backgroundImage: `url(${map.image})` }}
            >
              <div className="map-overlay" />
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
        FIGHT IN {maps[selectedIndex].name.toUpperCase()}
      </button>

      <style>{`
        .map-select {
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

        .selected-fighter {
          display: flex;
          align-items: center;
          gap: 0.8rem;
          padding: 0.8rem 1.5rem;
          background: rgba(0,0,0,0.3);
          border-radius: 30px;
          color: #fff;
          font-weight: 700;
        }

        .fighter-badge {
          width: 30px;
          height: 30px;
          border-radius: 50%;
        }

        .map-grid {
          flex: 1;
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 2rem;
          max-width: 1000px;
          margin: 0 auto;
          width: 100%;
        }

        .map-card {
          border: none;
          border-radius: 20px;
          overflow: hidden;
          cursor: pointer;
          transition: all 0.3s;
          padding: 0;
          background: none;
        }

        .map-card:hover {
          transform: scale(1.02);
        }

        .map-card.selected {
          box-shadow: 0 0 0 4px #ffdd00, 0 10px 40px rgba(255,221,0,0.3);
        }

        .map-preview {
          position: relative;
          width: 100%;
          height: 250px;
          background-size: cover;
          background-position: center;
          display: flex;
          align-items: flex-end;
        }

        .map-overlay {
          position: absolute;
          inset: 0;
          background: linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 50%);
        }

        .map-info {
          position: relative;
          z-index: 1;
          padding: 1.5rem;
          width: 100%;
        }

        .map-info h2 {
          margin: 0 0 0.5rem 0;
          font-size: 1.8rem;
          color: #fff;
          text-shadow: 2px 2px 0 #000;
        }

        .map-info p {
          margin: 0;
          color: rgba(255,255,255,0.7);
          font-size: 1rem;
        }

        .confirm-button {
          align-self: center;
          margin-top: 2rem;
          padding: 1.2rem 3rem;
          font-size: 1.5rem;
          font-weight: 800;
          color: #fff;
          background: linear-gradient(180deg, #ff6b6b 0%, #ee4444 100%);
          border: none;
          border-radius: 50px;
          cursor: pointer;
          box-shadow: 0 5px 0 #990000, 0 8px 15px rgba(0,0,0,0.4);
          transition: all 0.2s;
        }

        .confirm-button:hover {
          transform: translateY(-3px);
          box-shadow: 0 8px 0 #990000, 0 12px 20px rgba(0,0,0,0.5);
        }

        .confirm-button:active {
          transform: translateY(2px);
          box-shadow: 0 2px 0 #990000, 0 4px 8px rgba(0,0,0,0.3);
        }
      `}</style>
    </div>
  );
};
