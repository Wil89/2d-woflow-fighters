import { database, ref, set, get, update, remove, onValue, onDisconnect } from './firebase';
import type {
  CharacterData,
  Tournament,
  TournamentMeta,
  TournamentPlayer,
  TournamentMatch
} from '../types/game';

export type TournamentConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface TournamentCallbacks {
  onStatusChange: (status: TournamentConnectionStatus) => void;
  onTournamentUpdate: (tournament: Tournament | null) => void;
  onMatchReady: (match: TournamentMatch, opponent: TournamentPlayer) => void;
  onError: (error: string) => void;
}

// Generate a short tournament code
const generateTournamentCode = (): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
};

// Get or create a persistent player ID
const getOrCreatePlayerId = (): string => {
  const stored = localStorage.getItem('tournament_player_id');
  if (stored) return stored;

  const newId = crypto.randomUUID();
  localStorage.setItem('tournament_player_id', newId);
  return newId;
};

class TournamentFirebaseService {
  private tournamentCode: string = '';
  private playerId: string = '';
  private callbacks: TournamentCallbacks | null = null;
  private unsubscribers: (() => void)[] = [];
  private isCreator: boolean = false;

  constructor() {
    this.playerId = getOrCreatePlayerId();
    // Restore tournament code from localStorage if available (handles React Strict Mode)
    const savedCode = localStorage.getItem('active_tournament_code');
    if (savedCode) {
      this.tournamentCode = savedCode;
      console.log('Restored tournament code from localStorage:', savedCode);
    }
  }

  getPlayerId(): string {
    return this.playerId;
  }

  getTournamentCode(): string {
    return this.tournamentCode;
  }

  getIsCreator(): boolean {
    return this.isCreator;
  }

  setCallbacks(callbacks: TournamentCallbacks) {
    this.callbacks = callbacks;
  }

  // Save tournament code to localStorage for persistence across React Strict Mode remounts
  private saveTournamentCode(code: string) {
    this.tournamentCode = code;
    if (code) {
      localStorage.setItem('active_tournament_code', code);
    } else {
      localStorage.removeItem('active_tournament_code');
    }
  }

  // Create a new tournament
  async createTournament(name: string, size: 4 | 8 | 16, playerName: string): Promise<string> {
    this.isCreator = true;
    this.saveTournamentCode(generateTournamentCode());

    try {
      this.callbacks?.onStatusChange('connecting');

      const tournamentRef = ref(database, `tournaments/${this.tournamentCode}`);

      const meta: TournamentMeta = {
        id: this.tournamentCode,
        code: this.tournamentCode,
        name,
        creatorId: this.playerId,
        status: 'waiting',
        size,
        createdAt: Date.now(),
        startedAt: null,
        completedAt: null,
        currentRound: 0,
        winnerId: null,
      };

      const player: TournamentPlayer = {
        id: this.playerId,
        name: playerName,
        seed: 0,
        character: null,
        status: 'joined',
        joinedAt: Date.now(),
      };

      await set(tournamentRef, {
        meta,
        players: { [this.playerId]: player },
        bracket: {},
      });

      // Setup presence
      await this.setupPresence();

      // Subscribe to tournament updates
      this.subscribeToTournament();

      this.callbacks?.onStatusChange('connected');
      return this.tournamentCode;
    } catch (error) {
      this.callbacks?.onError('Failed to create tournament');
      this.callbacks?.onStatusChange('error');
      throw error;
    }
  }

  // Join an existing tournament
  async joinTournament(code: string, playerName: string): Promise<void> {
    this.isCreator = false;
    this.saveTournamentCode(code.toUpperCase());

    try {
      this.callbacks?.onStatusChange('connecting');

      // Check if tournament exists
      const tournamentRef = ref(database, `tournaments/${this.tournamentCode}`);
      const snapshot = await get(tournamentRef);

      if (!snapshot.exists()) {
        throw new Error('Tournament not found');
      }

      const data = snapshot.val();
      const meta = data.meta as TournamentMeta;
      const players = data.players || {};
      const playerCount = Object.keys(players).length;

      // Check if tournament is full
      if (playerCount >= meta.size) {
        throw new Error('Tournament is full');
      }

      // Check if tournament already started
      if (meta.status !== 'waiting') {
        throw new Error('Tournament has already started');
      }

      // Check if player already joined
      if (players[this.playerId]) {
        // Already joined, just reconnect
        this.setupPresence();
        this.subscribeToTournament();
        this.callbacks?.onStatusChange('connected');
        return;
      }

      // Add player to tournament
      const player: TournamentPlayer = {
        id: this.playerId,
        name: playerName,
        seed: 0,
        character: null,
        status: 'joined',
        joinedAt: Date.now(),
      };

      await set(ref(database, `tournaments/${this.tournamentCode}/players/${this.playerId}`), player);

      // Setup presence
      await this.setupPresence();

      // Subscribe to tournament updates
      this.subscribeToTournament();

      this.callbacks?.onStatusChange('connected');
    } catch (error) {
      this.callbacks?.onError(error instanceof Error ? error.message : 'Failed to join tournament');
      this.callbacks?.onStatusChange('error');
      throw error;
    }
  }

  // Leave tournament
  async leaveTournament(): Promise<void> {
    if (!this.tournamentCode) return;

    try {
      // Remove player from tournament
      await remove(ref(database, `tournaments/${this.tournamentCode}/players/${this.playerId}`));
      await remove(ref(database, `tournaments/${this.tournamentCode}/presence/${this.playerId}`));

      this.unsubscribe();
      this.saveTournamentCode(''); // Clear tournament code
      this.isCreator = false;
      this.callbacks?.onStatusChange('disconnected');
    } catch (error) {
      console.error('Error leaving tournament:', error);
    }
  }

  // Set player's character
  async setCharacter(character: CharacterData): Promise<void> {
    if (!this.tournamentCode) return;

    await update(ref(database, `tournaments/${this.tournamentCode}/players/${this.playerId}`), {
      character,
    });
  }

  // Set player as ready
  async setReady(): Promise<void> {
    if (!this.tournamentCode) return;

    await update(ref(database, `tournaments/${this.tournamentCode}/players/${this.playerId}`), {
      status: 'ready',
    });
  }

  // Start tournament (creator only)
  async startTournament(): Promise<void> {
    if (!this.tournamentCode || !this.isCreator) return;

    const tournamentRef = ref(database, `tournaments/${this.tournamentCode}`);
    const snapshot = await get(tournamentRef);

    if (!snapshot.exists()) return;

    const data = snapshot.val();
    const players = Object.values(data.players || {}) as TournamentPlayer[];
    const meta = data.meta as TournamentMeta;

    // Check all players are ready
    const allReady = players.every(p => p.status === 'ready');
    if (!allReady) {
      this.callbacks?.onError('Not all players are ready');
      return;
    }

    // Check we have correct number of players
    if (players.length !== meta.size) {
      this.callbacks?.onError(`Need exactly ${meta.size} players to start`);
      return;
    }

    // Generate bracket
    const bracket = this.generateBracket(players, meta.size);

    // Update tournament
    await update(ref(database, `tournaments/${this.tournamentCode}`), {
      'meta/status': 'in_progress',
      'meta/startedAt': Date.now(),
      'meta/currentRound': 1,
      bracket,
    });
  }

  // Generate tournament bracket with random seeding
  private generateBracket(players: TournamentPlayer[], size: 4 | 8 | 16): Record<string, Record<string, TournamentMatch>> {
    // Shuffle players for random seeding
    const shuffled = [...players].sort(() => Math.random() - 0.5);

    // Assign seeds
    shuffled.forEach((player, index) => {
      player.seed = index + 1;
      // Update player seed in Firebase
      update(ref(database, `tournaments/${this.tournamentCode}/players/${player.id}`), {
        seed: index + 1,
      });
    });

    const bracket: Record<string, Record<string, TournamentMatch>> = {};
    // 4 players = 2 rounds, 8 players = 3 rounds, 16 players = 4 rounds
    const totalRounds = size === 4 ? 2 : size === 8 ? 3 : 4;

    // Standard bracket seeding pairings
    const seedPairings = size === 16
      ? [[1,16], [8,9], [5,12], [4,13], [3,14], [6,11], [7,10], [2,15]]
      : size === 8
        ? [[1,8], [4,5], [3,6], [2,7]]
        : [[1,4], [2,3]]; // 4 players

    // Create round 1 matches
    bracket['round1'] = {};
    seedPairings.forEach((pairing, index) => {
      const matchId = `match${index + 1}`;
      const player1 = shuffled[pairing[0] - 1];
      const player2 = shuffled[pairing[1] - 1];

      bracket['round1'][matchId] = {
        matchId,
        roundNumber: 1,
        matchNumber: index + 1,
        player1Id: player1.id,
        player2Id: player2.id,
        player1Ready: false,
        player2Ready: false,
        status: 'pending',
        winnerId: null,
        roomCode: null,
        startedAt: null,
        completedAt: null,
        scores: { player1: 0, player2: 0 },
      };
    });

    // Create placeholder matches for subsequent rounds
    for (let round = 2; round <= totalRounds; round++) {
      const matchesInRound = Math.pow(2, totalRounds - round);
      bracket[`round${round}`] = {};

      for (let i = 1; i <= matchesInRound; i++) {
        const matchId = `match${i}`;
        bracket[`round${round}`][matchId] = {
          matchId,
          roundNumber: round,
          matchNumber: i,
          player1Id: null,
          player2Id: null,
          player1Ready: false,
          player2Ready: false,
          status: 'pending',
          winnerId: null,
          roomCode: null,
          startedAt: null,
          completedAt: null,
          scores: { player1: 0, player2: 0 },
        };
      }
    }

    return bracket;
  }

  // Set match ready status for current player
  async setMatchReady(matchId: string, roundNumber: number): Promise<void> {
    if (!this.tournamentCode) {
      console.error('setMatchReady: No tournament code');
      return;
    }

    console.log('setMatchReady:', { matchId, roundNumber, tournamentCode: this.tournamentCode });

    const matchRef = ref(database, `tournaments/${this.tournamentCode}/bracket/round${roundNumber}/${matchId}`);
    const snapshot = await get(matchRef);

    if (!snapshot.exists()) {
      console.error('setMatchReady: Match not found');
      return;
    }

    const match = snapshot.val() as TournamentMatch;
    const isPlayer1 = match.player1Id === this.playerId;

    console.log('setMatchReady: Current match state', {
      player1Id: match.player1Id,
      player2Id: match.player2Id,
      player1Ready: match.player1Ready,
      player2Ready: match.player2Ready,
      status: match.status,
      isPlayer1,
      myPlayerId: this.playerId
    });

    await update(matchRef, {
      [isPlayer1 ? 'player1Ready' : 'player2Ready']: true,
    });

    // Check if both players are ready
    const updatedSnapshot = await get(matchRef);
    const updatedMatch = updatedSnapshot.val() as TournamentMatch;

    console.log('setMatchReady: After update', {
      player1Ready: updatedMatch.player1Ready,
      player2Ready: updatedMatch.player2Ready,
      status: updatedMatch.status
    });

    if (updatedMatch.player1Ready && updatedMatch.player2Ready && updatedMatch.status === 'pending') {
      // Both ready - create room and start match
      const roomCode = generateTournamentCode();
      console.log('setMatchReady: Both ready! Creating room:', roomCode);
      await update(matchRef, {
        status: 'ready',
        roomCode,
      });
    }
  }

  // Start a match (when both players are ready)
  async startMatch(matchId: string, roundNumber: number): Promise<void> {
    if (!this.tournamentCode) return;

    const matchRef = ref(database, `tournaments/${this.tournamentCode}/bracket/round${roundNumber}/${matchId}`);
    await update(matchRef, {
      status: 'in_progress',
      startedAt: Date.now(),
    });
  }

  // Update live scores during a match (for spectator view)
  async updateLiveScore(
    matchId: string,
    roundNumber: number,
    scores: { player1: number; player2: number },
    currentGameRound: number
  ): Promise<void> {
    if (!this.tournamentCode) return;

    const matchRef = ref(database, `tournaments/${this.tournamentCode}/bracket/round${roundNumber}/${matchId}`);
    await update(matchRef, {
      scores,
      currentGameRound,
      lastUpdate: Date.now(),
    });
  }

  // Report match result
  async reportMatchResult(
    matchId: string,
    roundNumber: number,
    winnerId: string,
    scores: { player1: number; player2: number }
  ): Promise<void> {
    if (!this.tournamentCode) return;

    const matchRef = ref(database, `tournaments/${this.tournamentCode}/bracket/round${roundNumber}/${matchId}`);
    const snapshot = await get(matchRef);

    if (!snapshot.exists()) return;

    const match = snapshot.val() as TournamentMatch;
    const loserId = match.player1Id === winnerId ? match.player2Id : match.player1Id;

    // Update match
    await update(matchRef, {
      status: 'completed',
      winnerId,
      scores,
      completedAt: Date.now(),
    });

    // Update loser status
    if (loserId) {
      await update(ref(database, `tournaments/${this.tournamentCode}/players/${loserId}`), {
        status: 'eliminated',
      });
    }

    // Advance winner to next round
    await this.advanceWinner(matchId, roundNumber, winnerId);
  }

  // Report forfeit
  async reportForfeit(matchId: string, roundNumber: number, forfeitingPlayerId: string): Promise<void> {
    if (!this.tournamentCode) return;

    const matchRef = ref(database, `tournaments/${this.tournamentCode}/bracket/round${roundNumber}/${matchId}`);
    const snapshot = await get(matchRef);

    if (!snapshot.exists()) return;

    const match = snapshot.val() as TournamentMatch;
    const winnerId = match.player1Id === forfeitingPlayerId ? match.player2Id : match.player1Id;

    if (!winnerId) return;

    // Update match as forfeit
    await update(matchRef, {
      status: 'forfeit',
      winnerId,
      completedAt: Date.now(),
    });

    // Update forfeiting player status
    await update(ref(database, `tournaments/${this.tournamentCode}/players/${forfeitingPlayerId}`), {
      status: 'eliminated',
    });

    // Advance winner
    await this.advanceWinner(matchId, roundNumber, winnerId);
  }

  // Advance winner to next round
  private async advanceWinner(matchId: string, roundNumber: number, winnerId: string): Promise<void> {
    const tournamentRef = ref(database, `tournaments/${this.tournamentCode}`);
    const snapshot = await get(tournamentRef);

    if (!snapshot.exists()) return;

    const data = snapshot.val();
    const meta = data.meta as TournamentMeta;
    const players = data.players || {};
    // 4 players = 2 rounds, 8 players = 3 rounds, 16 players = 4 rounds
    const totalRounds = meta.size === 4 ? 2 : meta.size === 8 ? 3 : 4;

    // Get winner's name for logging
    const winnerPlayer = players[winnerId];
    console.log('advanceWinner:', {
      matchId,
      roundNumber,
      winnerId,
      winnerName: winnerPlayer?.name || 'UNKNOWN',
      winnerCharacter: winnerPlayer?.character?.name || 'NO CHARACTER',
      totalRounds
    });

    // Check if this was the finals
    if (roundNumber === totalRounds) {
      // Tournament complete!
      console.log('advanceWinner: This was the finals! Winner:', winnerId);
      await update(ref(database, `tournaments/${this.tournamentCode}/meta`), {
        status: 'completed',
        winnerId,
        completedAt: Date.now(),
      });

      await update(ref(database, `tournaments/${this.tournamentCode}/players/${winnerId}`), {
        status: 'champion',
      });
      return;
    }

    // Find next match and slot
    const matchNumber = parseInt(matchId.replace('match', ''));
    const nextRound = roundNumber + 1;
    const nextMatchNumber = Math.ceil(matchNumber / 2);
    const nextMatchId = `match${nextMatchNumber}`;
    const slot = matchNumber % 2 === 1 ? 'player1Id' : 'player2Id';

    console.log('advanceWinner: Moving to next round', {
      nextRound,
      nextMatchId,
      slot,
      winnerId
    });

    // Update next match with winner
    await update(ref(database, `tournaments/${this.tournamentCode}/bracket/round${nextRound}/${nextMatchId}`), {
      [slot]: winnerId,
    });

    // Check if round is complete
    await this.checkRoundComplete(roundNumber);
  }

  // Check if all matches in a round are complete
  private async checkRoundComplete(roundNumber: number): Promise<void> {
    const roundRef = ref(database, `tournaments/${this.tournamentCode}/bracket/round${roundNumber}`);
    const snapshot = await get(roundRef);

    if (!snapshot.exists()) return;

    const matches = Object.values(snapshot.val()) as TournamentMatch[];
    const allComplete = matches.every(m => m.status === 'completed' || m.status === 'forfeit');

    if (allComplete) {
      // Advance to next round
      await update(ref(database, `tournaments/${this.tournamentCode}/meta`), {
        currentRound: roundNumber + 1,
      });
    }
  }

  // Get current match for player (searches all rounds)
  getMyCurrentMatch(tournament: Tournament): TournamentMatch | null {
    if (!tournament || tournament.meta.status !== 'in_progress') return null;

    const totalRounds = tournament.meta.size === 4 ? 2 : tournament.meta.size === 8 ? 3 : 4;

    // Search all rounds for player's next incomplete match
    for (let round = 1; round <= totalRounds; round++) {
      const roundMatches = tournament.bracket[`round${round}`];
      if (!roundMatches) continue;

      for (const match of Object.values(roundMatches)) {
        if ((match.player1Id === this.playerId || match.player2Id === this.playerId) &&
            match.status !== 'completed' && match.status !== 'forfeit') {
          return match;
        }
      }
    }

    return null;
  }

  // Check if player is host for a match
  isMatchHost(match: TournamentMatch): boolean {
    // Player 1 (lower seed) is always host
    return match.player1Id === this.playerId;
  }

  // Setup Firebase presence for disconnect detection
  private async setupPresence(): Promise<void> {
    const connectedRef = ref(database, '.info/connected');
    const presenceRef = ref(database, `tournaments/${this.tournamentCode}/presence/${this.playerId}`);

    const unsubscribe = onValue(connectedRef, async (snap) => {
      if (snap.val() === true) {
        await set(presenceRef, { online: true, lastSeen: Date.now() });
        onDisconnect(presenceRef).set({ online: false, lastSeen: Date.now() });
      }
    });

    this.unsubscribers.push(unsubscribe);
  }

  // Subscribe to tournament updates
  private subscribeToTournament(): void {
    const tournamentRef = ref(database, `tournaments/${this.tournamentCode}`);

    const unsubscribe = onValue(tournamentRef, (snapshot) => {
      if (!snapshot.exists()) {
        this.callbacks?.onTournamentUpdate(null);
        return;
      }

      const data = snapshot.val();

      // Ensure meta exists before creating tournament object
      if (!data.meta) {
        console.warn('Tournament data missing meta');
        return;
      }

      const tournament: Tournament = {
        meta: data.meta,
        players: data.players || {},
        bracket: data.bracket || {},
      };

      this.callbacks?.onTournamentUpdate(tournament);

      // Check if we have a match ready (for any round)
      if (tournament.meta.status === 'in_progress') {
        const myMatch = this.getMyCurrentMatch(tournament);
        if (myMatch) {
          if (myMatch.status === 'ready') {
            const opponentId = myMatch.player1Id === this.playerId ? myMatch.player2Id : myMatch.player1Id;
            if (opponentId && tournament.players[opponentId]) {
              this.callbacks?.onMatchReady(myMatch, tournament.players[opponentId]);
            }
          }
        }
      }
    });

    this.unsubscribers.push(unsubscribe);
  }

  // Unsubscribe from all listeners
  unsubscribe(): void {
    this.unsubscribers.forEach(unsub => unsub());
    this.unsubscribers = [];
  }

  // Get match data by matchId and roundNumber
  async getMatchData(matchId: string, roundNumber: number): Promise<TournamentMatch | null> {
    if (!this.tournamentCode) return null;

    const matchRef = ref(database, `tournaments/${this.tournamentCode}/bracket/round${roundNumber}/${matchId}`);
    const snapshot = await get(matchRef);

    if (!snapshot.exists()) return null;
    return snapshot.val() as TournamentMatch;
  }

  // Reconnect to tournament (used when returning from a match)
  async reconnect(): Promise<void> {
    if (!this.tournamentCode) {
      console.log('reconnect: No tournament code, skipping');
      return;
    }

    console.log('reconnect: Reconnecting to tournament', this.tournamentCode, 'unsubscribers:', this.unsubscribers.length);

    // Re-subscribe to tournament updates if not already subscribed
    if (this.unsubscribers.length === 0) {
      console.log('reconnect: Re-subscribing to tournament updates');
      await this.setupPresence();
      this.subscribeToTournament();
    } else {
      console.log('reconnect: Already subscribed, skipping re-subscribe');
    }

    // Force a manual fetch and callback to ensure UI updates
    const tournamentRef = ref(database, `tournaments/${this.tournamentCode}`);
    const snapshot = await get(tournamentRef);

    if (snapshot.exists()) {
      const data = snapshot.val();

      // Ensure meta exists
      if (!data.meta) {
        console.warn('Tournament data missing meta on reconnect');
        return;
      }

      const tournament: Tournament = {
        meta: data.meta,
        players: data.players || {},
        bracket: data.bracket || {},
      };

      this.callbacks?.onTournamentUpdate(tournament);
      this.callbacks?.onStatusChange('connected');

      // Check for match ready state
      if (tournament.meta.status === 'in_progress') {
        const myMatch = this.getMyCurrentMatch(tournament);
        if (myMatch && myMatch.status === 'ready') {
          const opponentId = myMatch.player1Id === this.playerId ? myMatch.player2Id : myMatch.player1Id;
          if (opponentId && tournament.players[opponentId]) {
            this.callbacks?.onMatchReady(myMatch, tournament.players[opponentId]);
          }
        }
      }
    }
  }

  // Disconnect and cleanup (but preserve tournament code - only leaveTournament clears it)
  disconnect(): void {
    console.log('tournament-firebase DISCONNECT called (preserving tournament code)');
    this.unsubscribe();
    // DO NOT clear tournament code here - it persists in localStorage
    // Only leaveTournament() should clear it
    this.isCreator = false;
    this.callbacks?.onStatusChange('disconnected');
  }
}

// Export singleton instance
export const tournamentService = new TournamentFirebaseService();
