import { create } from "zustand";
import {
  acknowledgeCard,
  applyRoll,
  advanceMovementOneStep,
  buildHouseOrHotel,
  buyPendingProperty,
  declareBankruptcy,
  declinePendingProperty,
  endTurn,
  mortgageProperty,
  payBail,
  playGetOutOfJailCard,
  placeAuctionBid,
  rollDiceForCurrentPlayer,
  selectSpace,
  sellBuilding,
  settleDebtIfPossible,
  unmortgageProperty,
  passAuctionTurn,
} from "./engine";
import { createGame } from "./setup";
import { loadGame, saveGame, clearSavedGame } from "./storage";
import type { GameState, PlayerSetup } from "./types";

interface GameStore {
  game: GameState | null;
  diceRolling: boolean;
  hasSavedGame: boolean;

  // Actions
  setGame: (game: GameState | null) => void;
  debugMutateGame: (mutator: (game: GameState) => GameState) => void;
  startGame: (players: PlayerSetup[]) => void;
  loadSavedGame: () => void;
  clearSavedGame: () => void;

  rollDice: () => void;
  debugRoll: (left: number, right: number) => void;
  setDiceRolling: (rolling: boolean) => void;

  advanceMovement: () => void;
  payBail: () => void;
  playGetOutOfJailCard: () => void;
  buyProperty: () => void;
  declineProperty: () => void;
  acknowledgeCard: () => void;
  endTurn: () => void;
  settleDebt: () => void;
  declareBankruptcy: () => void;
  buildHouse: (propertyId: number) => void;
  sellBuilding: (propertyId: number) => void;
  mortgage: (propertyId: number) => void;
  unmortgage: (propertyId: number) => void;
  setSelectedSpace: (spaceIndex: number | null) => void;
  placeBid: (amount: number) => void;
  passAuction: () => void;
}

export const useGameStore = create<GameStore>((set, get) => ({
  game: null,
  diceRolling: false,
  hasSavedGame: loadGame() !== null,

  setGame: (game) => {
    set({ game, hasSavedGame: game !== null });
    if (game) {
      saveGame(game);
      return;
    }

    clearSavedGame();
  },

  startGame: (players) => {
    const game = createGame(players);
    set({ game, hasSavedGame: true });
    saveGame(game);
  },

  debugMutateGame: (mutator) => {
    const { game } = get();
    if (!game) return;

    const nextGame = mutator(game);
    set({ game: nextGame, hasSavedGame: true });
    saveGame(nextGame);
  },

  loadSavedGame: () => {
    const saved = loadGame();
    if (saved) set({ game: saved, hasSavedGame: true });
  },

  clearSavedGame: () => {
    clearSavedGame();
    set({ game: null, hasSavedGame: false });
  },

  setDiceRolling: (diceRolling) => set({ diceRolling }),

  // Centralize persistence so action handlers don't drift.
  ...(() => {
    const persistGame = (game: GameState | null) => {
      set({ game, hasSavedGame: game !== null });
      if (game) {
        saveGame(game);
      }
    };

    return {
      rollDice: () => {
        const { game } = get();
        if (!game) return;

        set({ diceRolling: true });
        const nextGame = rollDiceForCurrentPlayer(game);
        persistGame(nextGame);

        setTimeout(() => set({ diceRolling: false }), 700);
      },

      debugRoll: (left: number, right: number) => {
        const { game } = get();
        if (!game) return;

        persistGame(applyRoll(game, [left, right]));
      },

      advanceMovement: () => {
        const { game } = get();
        if (!game) return;
        persistGame(advanceMovementOneStep(game));
      },

      payBail: () => {
        const { game } = get();
        if (!game) return;
        persistGame(payBail(game));
      },

      playGetOutOfJailCard: () => {
        const { game } = get();
        if (!game) return;
        persistGame(playGetOutOfJailCard(game));
      },

      buyProperty: () => {
        const { game } = get();
        if (!game) return;
        persistGame(buyPendingProperty(game));
      },

      declineProperty: () => {
        const { game } = get();
        if (!game) return;
        persistGame(declinePendingProperty(game));
      },

      acknowledgeCard: () => {
        const { game } = get();
        if (!game) return;
        persistGame(acknowledgeCard(game));
      },

      endTurn: () => {
        const { game } = get();
        if (!game) return;
        persistGame(endTurn(game));
      },

      settleDebt: () => {
        const { game } = get();
        if (!game) return;
        persistGame(settleDebtIfPossible(game));
      },

      declareBankruptcy: () => {
        const { game } = get();
        if (!game) return;
        persistGame(declareBankruptcy(game));
      },

      buildHouse: (propertyId: number) => {
        const { game } = get();
        if (!game) return;
        persistGame(buildHouseOrHotel(game, propertyId));
      },

      sellBuilding: (propertyId: number) => {
        const { game } = get();
        if (!game) return;
        persistGame(sellBuilding(game, propertyId));
      },

      mortgage: (propertyId: number) => {
        const { game } = get();
        if (!game) return;
        persistGame(mortgageProperty(game, propertyId));
      },

      unmortgage: (propertyId: number) => {
        const { game } = get();
        if (!game) return;
        persistGame(unmortgageProperty(game, propertyId));
      },

      placeBid: (amount: number) => {
        const { game } = get();
        if (!game) return;
        persistGame(placeAuctionBid(game, amount));
      },

      passAuction: () => {
        const { game } = get();
        if (!game) return;
        persistGame(passAuctionTurn(game));
      },
    };
  })(),

  setSelectedSpace: (spaceIndex) => {
    const { game } = get();
    if (!game) return;
    const nextGame = selectSpace(game, spaceIndex);
    set({ game: nextGame });
  },
}));
