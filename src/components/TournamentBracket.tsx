import type { Tournament, TournamentMatch, TournamentPlayer } from '../types/game';

interface TournamentBracketProps {
  tournament: Tournament;
  currentPlayerId: string;
  highlightMatchId?: string;
}

export const TournamentBracket = ({ tournament, currentPlayerId, highlightMatchId }: TournamentBracketProps) => {
  const { meta, players, bracket } = tournament;
  // 4 players = 2 rounds, 8 players = 3 rounds, 16 players = 4 rounds
  const totalRounds = meta.size === 4 ? 2 : meta.size === 8 ? 3 : 4;

  const getRoundName = (round: number): string => {
    if (round === totalRounds) return 'FINALS';
    if (round === totalRounds - 1) return 'SEMIFINALS';
    if (round === totalRounds - 2) return 'QUARTERFINALS';
    return `ROUND ${round}`;
  };

  const getPlayer = (playerId: string | null): TournamentPlayer | null => {
    if (!playerId) return null;
    return players[playerId] || null;
  };

  const getMatchStatusClass = (match: TournamentMatch): string => {
    if (match.status === 'completed' || match.status === 'forfeit') return 'completed';
    if (match.status === 'in_progress') return 'in-progress';
    if (match.status === 'ready') return 'ready';
    return 'pending';
  };

  const isMyMatch = (match: TournamentMatch): boolean => {
    return match.player1Id === currentPlayerId || match.player2Id === currentPlayerId;
  };

  const renderMatch = (match: TournamentMatch) => {
    const player1 = getPlayer(match.player1Id);
    const player2 = getPlayer(match.player2Id);
    const isHighlighted = highlightMatchId === match.matchId || isMyMatch(match);
    const statusClass = getMatchStatusClass(match);

    return (
      <div
        key={match.matchId}
        className={`bracket-match ${statusClass} ${isHighlighted ? 'highlighted' : ''}`}
      >
        <div className={`match-slot ${match.winnerId === match.player1Id ? 'winner' : ''} ${match.player1Id === currentPlayerId ? 'me' : ''}`}>
          {player1 ? (
            <>
              <span className="seed">#{player1.seed}</span>
              <span className="name">{player1.name}</span>
              {match.status === 'completed' && <span className="score">{match.scores.player1}</span>}
            </>
          ) : (
            <span className="tbd">TBD</span>
          )}
        </div>
        <div className="match-vs">VS</div>
        <div className={`match-slot ${match.winnerId === match.player2Id ? 'winner' : ''} ${match.player2Id === currentPlayerId ? 'me' : ''}`}>
          {player2 ? (
            <>
              <span className="seed">#{player2.seed}</span>
              <span className="name">{player2.name}</span>
              {match.status === 'completed' && <span className="score">{match.scores.player2}</span>}
            </>
          ) : (
            <span className="tbd">TBD</span>
          )}
        </div>
        {match.status === 'forfeit' && <div className="forfeit-badge">FORFEIT</div>}
      </div>
    );
  };

  const renderRound = (roundNumber: number) => {
    const roundKey = `round${roundNumber}`;
    const roundMatches = bracket[roundKey] || {};
    const matches = Object.values(roundMatches).sort((a, b) => a.matchNumber - b.matchNumber);

    return (
      <div key={roundKey} className="bracket-round">
        <div className="round-header">{getRoundName(roundNumber)}</div>
        <div className="round-matches">
          {matches.map(match => renderMatch(match))}
        </div>
      </div>
    );
  };

  return (
    <div className="tournament-bracket">
      <div className="bracket-container">
        {Array.from({ length: totalRounds }, (_, i) => renderRound(i + 1))}
      </div>

      {meta.status === 'completed' && meta.winnerId && (
        <div className="champion-banner">
          <div className="trophy">🏆</div>
          <div className="champion-text">CHAMPION</div>
          <div className="champion-name">
            {players[meta.winnerId]?.name || (() => {
              // Fallback: search for winner in finals match
              const finalsRound = bracket[`round${totalRounds}`];
              const finalsMatch = finalsRound ? Object.values(finalsRound)[0] : null;
              if (finalsMatch?.winnerId) {
                const winner = players[finalsMatch.winnerId];
                if (winner) return winner.name;
              }
              // Debug: log what data we have
              console.log('Champion display issue:', {
                winnerId: meta.winnerId,
                playersKeys: Object.keys(players),
                hasWinnerInPlayers: !!players[meta.winnerId]
              });
              return 'Champion';
            })()}
          </div>
        </div>
      )}

      <style>{`
        .tournament-bracket {
          width: 100%;
          overflow-x: auto;
          padding: 1rem;
        }

        .bracket-container {
          display: flex;
          gap: 1rem;
          min-width: max-content;
          align-items: flex-start;
        }

        .bracket-round {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          min-width: 180px;
        }

        .round-header {
          font-size: 0.6rem;
          color: #ffcc00;
          text-align: center;
          padding: 0.5rem;
          background: linear-gradient(180deg, #333 0%, #222 100%);
          border: 2px solid #555;
          text-shadow: 2px 2px 0 #000;
        }

        .round-matches {
          display: flex;
          flex-direction: column;
          gap: 0.8rem;
          justify-content: space-around;
          flex: 1;
        }

        .bracket-match {
          background: linear-gradient(180deg, #1a1a2e 0%, #0d0d1a 100%);
          border: 3px solid #333;
          padding: 0.5rem;
          position: relative;
        }

        .bracket-match.pending {
          border-color: #333;
          opacity: 0.7;
        }

        .bracket-match.ready {
          border-color: #ffcc00;
          box-shadow: 0 0 15px rgba(255, 204, 0, 0.3);
        }

        .bracket-match.in-progress {
          border-color: #44BB44;
          box-shadow: 0 0 15px rgba(68, 187, 68, 0.3);
          animation: matchPulse 1.5s ease-in-out infinite;
        }

        .bracket-match.completed {
          border-color: #666;
        }

        .bracket-match.highlighted {
          border-color: #FF66AA;
          box-shadow: 0 0 20px rgba(255, 102, 170, 0.4);
        }

        @keyframes matchPulse {
          0%, 100% { box-shadow: 0 0 15px rgba(68, 187, 68, 0.3); }
          50% { box-shadow: 0 0 25px rgba(68, 187, 68, 0.6); }
        }

        .match-slot {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          padding: 0.4rem;
          background: #111;
          border: 1px solid #333;
          min-height: 28px;
        }

        .match-slot.winner {
          background: linear-gradient(90deg, rgba(68, 187, 68, 0.2), transparent);
          border-color: #44BB44;
        }

        .match-slot.me {
          background: linear-gradient(90deg, rgba(255, 102, 170, 0.2), transparent);
        }

        .match-slot.winner.me {
          background: linear-gradient(90deg, rgba(68, 187, 68, 0.3), rgba(255, 102, 170, 0.2));
        }

        .seed {
          font-size: 0.4rem;
          color: #888;
          min-width: 20px;
        }

        .name {
          font-size: 0.5rem;
          color: #fff;
          flex: 1;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .score {
          font-size: 0.5rem;
          color: #ffcc00;
          font-weight: bold;
          min-width: 12px;
          text-align: right;
        }

        .tbd {
          font-size: 0.4rem;
          color: #555;
          font-style: italic;
        }

        .match-vs {
          font-size: 0.4rem;
          color: #666;
          text-align: center;
          padding: 0.1rem 0;
        }

        .forfeit-badge {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background: rgba(255, 68, 68, 0.9);
          color: #fff;
          font-size: 0.4rem;
          padding: 0.2rem 0.5rem;
          border: 1px solid #ff4444;
        }

        .champion-banner {
          margin-top: 1.5rem;
          text-align: center;
          padding: 1rem;
          background: linear-gradient(180deg, #2a1a0a 0%, #1a1a0a 100%);
          border: 4px solid #ffcc00;
          box-shadow: 0 0 30px rgba(255, 204, 0, 0.4);
        }

        .trophy {
          font-size: 3rem;
          animation: trophyBounce 1s ease-in-out infinite;
        }

        @keyframes trophyBounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }

        .champion-text {
          font-size: 1rem;
          color: #ffcc00;
          text-shadow: 2px 2px 0 #000, 0 0 20px #ffcc00;
          margin: 0.5rem 0;
        }

        .champion-name {
          font-size: 1.2rem;
          color: #fff;
          text-shadow: 2px 2px 0 #000;
        }

        /* Responsive */
        @media (max-width: 600px) {
          .bracket-round {
            min-width: 140px;
          }

          .round-header {
            font-size: 0.5rem;
          }

          .name {
            font-size: 0.4rem;
          }

          .seed, .score, .match-vs, .tbd {
            font-size: 0.35rem;
          }
        }
      `}</style>
    </div>
  );
};
