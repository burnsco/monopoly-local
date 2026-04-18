import { describe, expect, it } from "vitest";

import {
  acknowledgeCard,
  applyRoll,
  buildHouseOrHotel,
  buyPendingProperty,
  getBuildActions,
  playGetOutOfJailCard,
} from "../src/game/engine";
import { endTurn } from "../src/game/engine";
import { createGame } from "../src/game/setup";
import type { DiceTuple, GameState } from "../src/game/types";

function withGame(mutator: (state: GameState) => GameState): GameState {
  return mutator(
    createGame([
      { name: "Ada", token: "Top Hat", color: "#e4572e" },
      { name: "Grace", token: "Battleship", color: "#4f86f7" },
    ]),
  );
}

describe("game engine", () => {
  it("buys a pending property and assigns ownership", () => {
    const game = withGame((state) => ({
      ...state,
      phase: "await_purchase",
      pendingPurchase: { propertyId: 1 },
    }));

    const next = buyPendingProperty(game);

    expect(next.deeds[1].ownerId).toBe("player-1");
    expect(next.players[0].money).toBe(1440);
    expect(next.phase).toBe("await_end_turn");
  });

  it("keeps an earned extra turn after a card is acknowledged", () => {
    const game = withGame((state) => ({
      ...state,
      phase: "show_card",
      extraTurn: true,
      pendingCard: {
        deck: "chance",
        cardId: "chance-bank-dividend",
        description: "Bank pays you dividend of $50.",
      },
    }));

    const next = acknowledgeCard(game);

    expect(next.extraTurn).toBe(true);
    expect(next.phase).toBe("await_end_turn");
    expect(next.players[0].money).toBe(1550);
  });

  it("enforces even building across a complete color set", () => {
    const game = withGame((state) => ({
      ...state,
      deeds: {
        ...state.deeds,
        1: { ...state.deeds[1], ownerId: "player-1" },
        3: { ...state.deeds[3], ownerId: "player-1" },
      },
    }));

    const afterFirstBuild = buildHouseOrHotel(game, 1);
    const firstActions = getBuildActions(afterFirstBuild, 1);
    const secondActions = getBuildActions(afterFirstBuild, 3);

    expect(afterFirstBuild.deeds[1].houses).toBe(1);
    expect(firstActions.canBuild).toBe(false);
    expect(secondActions.canBuild).toBe(true);
  });

  it("uses a get out of jail card without consuming the roll phase", () => {
    const game = withGame((state) => ({
      ...state,
      players: state.players.map((player, index) =>
        index === 0
          ? {
              ...player,
              inJail: true,
              jailTurns: 2,
              getOutOfJailCards: ["chance"],
            }
          : player,
      ),
    }));

    const next = playGetOutOfJailCard(game);

    expect(next.players[0].inJail).toBe(false);
    expect(next.players[0].jailTurns).toBe(0);
    expect(next.players[0].getOutOfJailCards).toEqual([]);
    expect(next.decks.chance.discardPile).toContain("chance-get-out");
    expect(next.phase).toBe("await_roll");
  });

  it("preserves the doubles counter when an earned extra turn starts", () => {
    const game = withGame((state) => ({
      ...state,
      phase: "await_end_turn",
      extraTurn: true,
      doublesRolledThisTurn: 2,
      dice: [4, 4],
      lastRollTotal: 8,
    }));

    const next = endTurn(game);

    expect(next.phase).toBe("await_roll");
    expect(next.extraTurn).toBe(false);
    expect(next.doublesRolledThisTurn).toBe(2);
    expect(next.dice).toBeNull();
    expect(next.lastRollTotal).toBeNull();
  });

  it("sends a player to jail after three doubles in a row across extra turns", () => {
    const rollDoublesAndKeepTurn = (state: GameState, dice: DiceTuple): GameState => {
      const afterRoll = applyRoll(state, dice);
      return endTurn({ ...afterRoll, phase: "await_end_turn", extraTurn: true });
    };

    const afterFirst = rollDoublesAndKeepTurn(
      withGame((state) => state),
      [3, 3],
    );
    const afterSecond = rollDoublesAndKeepTurn(afterFirst, [5, 5]);
    const afterThird = applyRoll(afterSecond, [6, 6]);

    const currentPlayer = afterThird.players[afterThird.currentPlayerIndex];
    expect(currentPlayer.inJail).toBe(true);
    expect(currentPlayer.position).toBe(10);
    expect(afterThird.phase).toBe("await_end_turn");
  });

  it("resets the doubles counter when the turn passes to the next player", () => {
    const game = withGame((state) => ({
      ...state,
      phase: "await_end_turn",
      extraTurn: false,
      doublesRolledThisTurn: 1,
      dice: [4, 4],
      lastRollTotal: 8,
    }));

    const next = endTurn(game);

    expect(next.currentPlayerIndex).toBe(1);
    expect(next.doublesRolledThisTurn).toBe(0);
  });
});
