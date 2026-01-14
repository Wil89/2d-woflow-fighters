import { useState } from 'react';
import type { CharacterData } from '../types/game';
import { characters } from '../data/gameData';

interface CharacterSelectProps {
  onSelect: (character: CharacterData) => void;
  onBack: () => void;
}

// Country to map image mapping
const countryMaps: Record<string, string> = {
  'USA': 'https://flagcdn.com/w320/us.png',
  'United Kingdom': 'https://flagcdn.com/w320/gb.png',
  'India': 'https://flagcdn.com/w320/in.png',
  'Hong Kong': 'https://flagcdn.com/w320/hk.png',
  'China': 'https://flagcdn.com/w320/cn.png',
  'Bosnia': 'https://flagcdn.com/w320/ba.png',
  'Cuba': 'https://flagcdn.com/w320/cu.png',
  'Romania': 'https://flagcdn.com/w320/ro.png',
};

export const CharacterSelect = ({ onSelect, onBack }: CharacterSelectProps) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const displayIndex = hoveredIndex ?? selectedIndex;
  const selectedCharacter = characters[displayIndex];

  return (
    <div className="character-select">
      {/* Background effects */}
      <div className="select-background">
        <div className="bg-pattern" />
        <div className="scanlines" />
      </div>

      {/* Header */}
      <div className="select-header">
        <button className="back-button" onClick={onBack}>← BACK</button>
        <div className="title-container">
          <h1>SELECT YOUR FIGHTER</h1>
          <div className="title-underline" />
        </div>
      </div>

      {/* Character Grid - SF2 Style */}
      <div className="character-grid-container">
        <div className="grid-frame">
          <div className="character-grid">
            {characters.map((char, index) => (
              <button
                key={char.id}
                className={`character-slot ${selectedIndex === index ? 'selected' : ''} ${hoveredIndex === index ? 'hovered' : ''}`}
                onClick={() => setSelectedIndex(index)}
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
                onDoubleClick={() => onSelect(char)}
              >
                <div className="slot-inner">
                  <img src={char.faceImage} alt={char.name} className="slot-face" />
                  <div className="slot-overlay" style={{ background: `linear-gradient(transparent 60%, ${char.color}88)` }} />
                </div>
                <span className="slot-name">{char.name}</span>
                {selectedIndex === index && <div className="select-cursor" />}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Character Details - Bottom Panel */}
      <div className="character-details">
        {/* Character Card */}
        <div className="detail-card">
          <div className="card-frame" style={{ borderColor: selectedCharacter.color }}>
            <div className="card-header" style={{ background: `linear-gradient(90deg, ${selectedCharacter.color}, ${selectedCharacter.secondaryColor})` }}>
              <span className="card-name">{selectedCharacter.name}</span>
              <span className="card-title">{selectedCharacter.jobTitle}</span>
            </div>
            <div className="card-portrait">
              <img src={selectedCharacter.faceImage} alt={selectedCharacter.name} />
            </div>
            <div className="card-country">
              <span className="country-flag">{selectedCharacter.countryFlag}</span>
              <span className="country-name">{selectedCharacter.country}</span>
            </div>
          </div>
        </div>

        {/* Description & Stats */}
        <div className="detail-info">
          <div className="info-section description-section">
            <div className="section-header">FIGHTER PROFILE</div>
            <p className="description-text">{selectedCharacter.description}</p>
            <div className="specialty-badge">
              <span className="specialty-label">SPECIALTY:</span>
              <span className="specialty-value">{selectedCharacter.specialty}</span>
            </div>
          </div>

          <div className="info-section stats-section">
            <div className="section-header">STATS</div>
            <div className="stats-grid">
              <div className="stat-row">
                <span className="stat-label">PWR</span>
                <div className="stat-bar-container">
                  {[...Array(10)].map((_, i) => (
                    <div
                      key={i}
                      className={`stat-block ${i < selectedCharacter.stats.power ? 'filled power' : ''}`}
                    />
                  ))}
                </div>
              </div>
              <div className="stat-row">
                <span className="stat-label">SPD</span>
                <div className="stat-bar-container">
                  {[...Array(10)].map((_, i) => (
                    <div
                      key={i}
                      className={`stat-block ${i < selectedCharacter.stats.speed ? 'filled speed' : ''}`}
                    />
                  ))}
                </div>
              </div>
              <div className="stat-row">
                <span className="stat-label">DEF</span>
                <div className="stat-bar-container">
                  {[...Array(10)].map((_, i) => (
                    <div
                      key={i}
                      className={`stat-block ${i < selectedCharacter.stats.defense ? 'filled defense' : ''}`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Country Map */}
        <div className="detail-map">
          <div className="map-frame">
            <div className="map-header">
              <span className="map-label">HOMELAND</span>
            </div>
            <div className="map-content">
              <img
                src={countryMaps[selectedCharacter.country] || countryMaps['USA']}
                alt={selectedCharacter.country}
                className="country-flag-large"
              />
              <div className="map-country-name">{selectedCharacter.country}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Confirm Button */}
      <button
        className="confirm-button"
        onClick={() => onSelect(characters[selectedIndex])}
      >
        <span className="button-text">FIGHT WITH {selectedCharacter.name}!</span>
      </button>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap');

        .character-select {
          min-height: 100vh;
          height: auto;
          background: #0a0a15;
          padding: 1rem 2rem 2rem;
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
            radial-gradient(ellipse at 20% 20%, rgba(255, 100, 0, 0.1) 0%, transparent 50%),
            radial-gradient(ellipse at 80% 80%, rgba(0, 100, 255, 0.1) 0%, transparent 50%),
            repeating-linear-gradient(0deg, transparent, transparent 50px, rgba(255,255,255,0.02) 50px, rgba(255,255,255,0.02) 51px);
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
          margin-bottom: 1rem;
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
          font-size: 1.5rem;
          color: #ffcc00;
          text-shadow:
            3px 3px 0 #ff6600,
            6px 6px 0 #000;
          margin: 0;
          letter-spacing: 0.05em;
        }

        .title-underline {
          height: 4px;
          background: linear-gradient(90deg, transparent, #ffcc00, #ff6600, #ffcc00, transparent);
          margin-top: 0.5rem;
        }

        /* Character Grid */
        .character-grid-container {
          position: relative;
          z-index: 1;
          margin-bottom: 1rem;
          display: flex;
          justify-content: center;
        }

        .grid-frame {
          background: linear-gradient(180deg, #1a1a2e 0%, #0d0d1a 100%);
          border: 4px solid #ffcc00;
          padding: 1rem;
          box-shadow:
            0 0 20px rgba(255, 204, 0, 0.3),
            inset 0 0 30px rgba(0, 0, 0, 0.5);
          max-width: 700px;
          width: 100%;
        }

        .character-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 0.6rem;
        }

        .character-slot {
          position: relative;
          background: #111;
          border: 3px solid #333;
          padding: 0;
          cursor: pointer;
          transition: all 0.1s;
          aspect-ratio: 1;
        }

        .character-slot:hover {
          border-color: #888;
          transform: scale(1.05);
          z-index: 2;
        }

        .character-slot.selected {
          border-color: #ffcc00;
          box-shadow: 0 0 20px rgba(255, 204, 0, 0.5);
        }

        .character-slot.selected .select-cursor {
          position: absolute;
          inset: -8px;
          border: 4px solid #ffcc00;
          animation: cursorBlink 0.3s step-end infinite;
        }

        @keyframes cursorBlink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        .slot-inner {
          width: 100%;
          height: 100%;
          position: relative;
          overflow: hidden;
        }

        .slot-face {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .slot-overlay {
          position: absolute;
          inset: 0;
        }

        .slot-name {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          background: rgba(0, 0, 0, 0.8);
          color: #fff;
          font-size: 0.5rem;
          padding: 0.3rem;
          text-align: center;
        }

        /* Character Details Panel */
        .character-details {
          display: flex;
          flex-wrap: wrap;
          gap: 1.5rem;
          position: relative;
          z-index: 1;
          max-width: 1000px;
          margin: 0 auto;
          width: 100%;
          min-height: 220px;
          justify-content: center;
        }

        /* Character Card */
        .detail-card {
          width: 220px;
          flex-shrink: 0;
        }

        .card-frame {
          background: #111;
          border: 4px solid;
          height: 100%;
          display: flex;
          flex-direction: column;
        }

        .card-header {
          padding: 0.5rem;
          text-align: center;
        }

        .card-name {
          display: block;
          font-size: 1rem;
          color: #fff;
          text-shadow: 2px 2px 0 #000;
        }

        .card-title {
          display: block;
          font-size: 0.5rem;
          color: rgba(255,255,255,0.8);
          margin-top: 0.3rem;
        }

        .card-portrait {
          flex: 1;
          background: #000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0.5rem;
        }

        .card-portrait img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .card-country {
          background: #222;
          padding: 0.5rem;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
        }

        .country-flag {
          font-size: 1.2rem;
        }

        .country-name {
          font-size: 0.5rem;
          color: #aaa;
        }

        /* Info Section */
        .detail-info {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 0.8rem;
        }

        .info-section {
          background: linear-gradient(180deg, #1a1a2e 0%, #111 100%);
          border: 3px solid #444;
          padding: 0.8rem;
        }

        .section-header {
          font-size: 0.7rem;
          color: #ffcc00;
          margin-bottom: 0.6rem;
          padding-bottom: 0.4rem;
          border-bottom: 2px solid #333;
        }

        .description-text {
          font-size: 0.6rem;
          color: #ddd;
          line-height: 2;
          margin: 0 0 1rem 0;
        }

        .specialty-badge {
          display: flex;
          gap: 0.5rem;
          align-items: center;
        }

        .specialty-label {
          font-size: 0.5rem;
          color: #888;
        }

        .specialty-value {
          font-size: 0.5rem;
          color: #ff6600;
          background: rgba(255, 102, 0, 0.2);
          padding: 0.2rem 0.5rem;
          border: 1px solid #ff6600;
        }

        /* Stats */
        .stats-grid {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .stat-row {
          display: flex;
          align-items: center;
          gap: 0.8rem;
        }

        .stat-label {
          width: 40px;
          font-size: 0.5rem;
          color: #888;
        }

        .stat-bar-container {
          display: flex;
          gap: 3px;
          flex: 1;
        }

        .stat-block {
          width: 20px;
          height: 12px;
          background: #222;
          border: 1px solid #333;
        }

        .stat-block.filled.power {
          background: linear-gradient(180deg, #ff6666 0%, #cc0000 100%);
          border-color: #ff0000;
          box-shadow: 0 0 5px rgba(255, 0, 0, 0.5);
        }

        .stat-block.filled.speed {
          background: linear-gradient(180deg, #66aaff 0%, #0066cc 100%);
          border-color: #0088ff;
          box-shadow: 0 0 5px rgba(0, 136, 255, 0.5);
        }

        .stat-block.filled.defense {
          background: linear-gradient(180deg, #66ff66 0%, #00cc00 100%);
          border-color: #00ff00;
          box-shadow: 0 0 5px rgba(0, 255, 0, 0.5);
        }

        /* Map Section */
        .detail-map {
          width: 200px;
          flex-shrink: 0;
        }

        .map-frame {
          background: #111;
          border: 3px solid #444;
          height: 100%;
          display: flex;
          flex-direction: column;
        }

        .map-header {
          background: linear-gradient(180deg, #333 0%, #222 100%);
          padding: 0.5rem;
          text-align: center;
        }

        .map-label {
          font-size: 0.5rem;
          color: #ffcc00;
        }

        .map-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 1rem;
          background: radial-gradient(circle at center, #1a1a2e 0%, #0a0a15 100%);
        }

        .country-flag-large {
          width: 140px;
          height: auto;
          border: 3px solid #333;
          box-shadow: 0 5px 20px rgba(0, 0, 0, 0.5);
        }

        .map-country-name {
          margin-top: 0.8rem;
          font-size: 0.6rem;
          color: #fff;
          text-align: center;
        }

        /* Confirm Button */
        .confirm-button {
          display: block;
          margin: 1rem auto 0;
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
          background: linear-gradient(180deg, #ffcc00 0%, #ff8800 50%, #cc4400 100%);
          border: 4px solid #fff;
          box-shadow: 6px 6px 0 #000;
          transition: all 0.1s;
        }

        .confirm-button:hover .button-text {
          transform: translateY(-3px);
          box-shadow: 9px 9px 0 #000;
          background: linear-gradient(180deg, #ffdd00 0%, #ffaa00 50%, #ff6600 100%);
        }

        .confirm-button:active .button-text {
          transform: translateY(2px);
          box-shadow: 2px 2px 0 #000;
        }

        /* CRT effect */
        .character-select::after {
          content: '';
          position: fixed;
          inset: 0;
          background: radial-gradient(ellipse at center, transparent 0%, rgba(0,0,0,0.4) 100%);
          pointer-events: none;
          z-index: 100;
        }

        /* Responsive styles for smaller screens */
        @media (max-width: 900px) {
          .character-details {
            flex-direction: column;
            max-height: none;
            align-items: center;
          }

          .detail-card {
            width: 100%;
            max-width: 300px;
          }

          .detail-info {
            width: 100%;
            max-width: 500px;
          }

          .detail-map {
            width: 100%;
            max-width: 300px;
          }

          .map-content {
            padding: 0.5rem;
          }

          .country-flag-large {
            width: 100px;
          }
        }

        @media (max-width: 600px) {
          .character-select {
            padding: 0.5rem 0.5rem 3rem;
          }

          .select-header {
            flex-direction: column;
            gap: 0.5rem;
            margin-bottom: 0.5rem;
          }

          .select-header h1 {
            font-size: 1rem;
          }

          .back-button {
            align-self: flex-start;
          }

          .grid-frame {
            padding: 0.5rem;
          }

          .character-grid {
            gap: 0.3rem;
          }

          .character-slot {
            max-width: 80px;
            max-height: 80px;
            border-width: 2px;
          }

          .slot-name {
            font-size: 0.35rem;
            padding: 0.2rem;
          }

          .character-details {
            gap: 0.5rem;
          }

          .detail-card {
            max-width: 250px;
          }

          .card-name {
            font-size: 0.8rem;
          }

          .card-title {
            font-size: 0.4rem;
          }

          .section-header {
            font-size: 0.5rem;
          }

          .description-text {
            font-size: 0.4rem;
            line-height: 1.6;
          }

          .stat-block {
            width: 14px;
            height: 10px;
          }

          .confirm-button .button-text {
            padding: 0.8rem 1.5rem;
            font-size: 0.6rem;
          }
        }

        @media (max-height: 700px) {
          .card-portrait {
            padding: 0.3rem;
          }
        }
      `}</style>
    </div>
  );
};
