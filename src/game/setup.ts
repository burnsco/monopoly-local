import { BOARD_SPACES } from "./data/board";
import { CHANCE_CARDS, COMMUNITY_CHEST_CARDS } from "./data/cards";
import { shuffle } from "./random";
import type { DeedState, GameState, PlayerSetup } from "./types";

const MAX_LOG_ENTRIES = 80;

export const TOKEN_OPTIONS = ["🚗", "🐕", "🚀", "🎩", "🦄", "🐢", "🛸", "🐙"];

export const COLOR_OPTIONS = [
  "#e4572e",
  "#4f86f7",
  "#16a085",
  "#f4b400",
  "#8e44ad",
  "#ff6f91",
  "#00b894",
  "#6c5ce7",
];

export function trimLog(entries: string[]): string[] {
  return entries.slice(-MAX_LOG_ENTRIES);
}

export function createInitialDeeds(): Record<number, DeedState> {
  return BOARD_SPACES.reduce<Record<number, DeedState>>((accumulator, space) => {
    if (space.type === "property" || space.type === "railroad" || space.type === "utility") {
      accumulator[space.index] = {
        ownerId: null,
        houses: 0,
        hotel: false,
        mortgaged: false,
      };
    }

    return accumulator;
  }, {});
}

export function createGame(playerSetups: PlayerSetup[]): GameState {
  const players = playerSetups.map((setup, index) => ({
    id: `player-${index + 1}`,
    name: setup.name.trim() || `Player ${index + 1}`,
    token: setup.token,
    color: setup.color,
    money: 1500,
    position: 0,
    inJail: false,
    jailTurns: 0,
    bankrupt: false,
    getOutOfJailCards: [],
  }));

  return {
    players,
    currentPlayerIndex: 0,
    phase: "await_roll",
    deeds: createInitialDeeds(),
    decks: {
      chance: {
        drawPile: shuffle(CHANCE_CARDS.map((card) => card.id)),
        discardPile: [],
      },
      communityChest: {
        drawPile: shuffle(COMMUNITY_CHEST_CARDS.map((card) => card.id)),
        discardPile: [],
      },
    },
    dice: null,
    lastRollTotal: null,
    doublesRolledThisTurn: 0,
    move: null,
    pendingPurchase: null,
    pendingCard: null,
    pendingAuction: null,
    pendingDebt: null,
    continuation: null,
    extraTurn: false,
    turn: 1,
    winnerId: null,
    log: trimLog([`${players[0]?.name ?? "Player 1"} starts the game.`]),
    settings: {
      passGoAmount: 200,
      bailAmount: 50,
      startingMoney: 1500,
      auctionsEnabled: true,
    },
    selectedSpace: 0,
  };
}
