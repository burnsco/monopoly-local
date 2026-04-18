import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { BOARD_SPACES } from "../game/data/board";
import { CARD_LOOKUP } from "../game/data/cards";
import { useGameStore } from "../game/store";
import type { AuctionState, DeckType, GameState, PendingCard } from "../game/types";

const DEBUG_PLAYERS = [
  { name: "A", token: "Anchor", color: "#e4572e" },
  { name: "B", token: "CarFront", color: "#4f86f7" },
];

function withLog(game: GameState, message: string): GameState {
  return {
    ...game,
    log: [...game.log, `[debug] ${message}`].slice(-80),
  };
}

function clearTransientState(game: GameState): GameState {
  return {
    ...game,
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
  };
}

function getOtherPlayerIndex(game: GameState): number {
  if (game.players.length < 2) {
    return game.currentPlayerIndex;
  }

  return game.currentPlayerIndex === 0 ? 1 : 0;
}

function showCard(game: GameState, deck: DeckType, cardId: string): GameState {
  const card = CARD_LOOKUP[cardId];
  const pendingCard: PendingCard = {
    deck,
    cardId,
    description: card.description,
  };

  return withLog(
    {
      ...clearTransientState(game),
      phase: "show_card",
      pendingCard,
    },
    `Forced ${deck} card: ${card.description}`,
  );
}

function createAuction(game: GameState, propertyId: number): AuctionState {
  const currentPlayer = game.players[game.currentPlayerIndex];
  const otherPlayer = game.players[getOtherPlayerIndex(game)];

  return {
    propertyId,
    activePlayerId: currentPlayer.id,
    eligiblePlayerIds: [currentPlayer.id, otherPlayer.id],
    passedPlayerIds: [],
    highestBidderId: null,
    highestBid: 0,
  };
}

function createRentTrap(game: GameState): GameState {
  const currentPlayer = game.players[game.currentPlayerIndex];
  const opponent = game.players[getOtherPlayerIndex(game)];

  return withLog(
    {
      ...clearTransientState(game),
      phase: "await_roll",
      selectedSpace: 3,
      players: game.players.map((candidate) => {
        if (candidate.id === currentPlayer.id) {
          return { ...candidate, position: 0, money: 40, inJail: false, jailTurns: 0 };
        }

        if (candidate.id === opponent.id) {
          return { ...candidate, money: 1500 };
        }

        return candidate;
      }),
      deeds: {
        ...game.deeds,
        1: { ...game.deeds[1], ownerId: opponent.id, houses: 0, hotel: false, mortgaged: false },
        3: { ...game.deeds[3], ownerId: opponent.id, houses: 0, hotel: false, mortgaged: false },
      },
    },
    `Created rent trap: ${currentPlayer.name} low on cash, ${opponent.name} owns the brown set`,
  );
}

function createBankruptcyScenario(game: GameState): GameState {
  const currentPlayer = game.players[game.currentPlayerIndex];
  const opponent = game.players[getOtherPlayerIndex(game)];

  return withLog(
    {
      ...clearTransientState(game),
      phase: "manage_debt",
      selectedSpace: 1,
      players: game.players.map((candidate) => {
        if (candidate.id === currentPlayer.id) {
          return { ...candidate, money: 0, inJail: false, jailTurns: 0 };
        }

        if (candidate.id === opponent.id) {
          return { ...candidate, money: 1500 };
        }

        return candidate;
      }),
      deeds: {
        ...game.deeds,
        1: {
          ...game.deeds[1],
          ownerId: currentPlayer.id,
          houses: 0,
          hotel: false,
          mortgaged: true,
        },
        3: { ...game.deeds[3], ownerId: null, houses: 0, hotel: false, mortgaged: false },
      },
      pendingDebt: {
        payerId: currentPlayer.id,
        amount: 200,
        recipientId: opponent.id,
        reason: "debug bankruptcy scenario",
      },
    },
    `Forced bankruptcy setup: ${currentPlayer.name} cannot cover debt to ${opponent.name}`,
  );
}

function createFullBuildCycleScenario(game: GameState): GameState {
  const currentPlayer = game.players[game.currentPlayerIndex];

  return withLog(
    {
      ...clearTransientState(game),
      phase: "await_end_turn",
      selectedSpace: 1,
      players: game.players.map((candidate) =>
        candidate.id === currentPlayer.id
          ? { ...candidate, money: 2500, inJail: false, jailTurns: 0 }
          : candidate,
      ),
      deeds: {
        ...game.deeds,
        1: {
          ...game.deeds[1],
          ownerId: currentPlayer.id,
          houses: 0,
          hotel: false,
          mortgaged: false,
        },
        3: {
          ...game.deeds[3],
          ownerId: currentPlayer.id,
          houses: 0,
          hotel: false,
          mortgaged: false,
        },
      },
    },
    `Created full build cycle setup for ${currentPlayer.name}`,
  );
}

export function DebugPanel() {
  const { game, startGame, clearSavedGame, debugMutateGame, debugRoll } = useGameStore();
  const [open, setOpen] = useState(false);
  const [jumpSpace, setJumpSpace] = useState("1");
  const [moneyValue, setMoneyValue] = useState("1500");
  const [propertyId, setPropertyId] = useState("1");

  const currentPlayer = game ? game.players[game.currentPlayerIndex] : null;
  const otherPlayer = useMemo(
    () => (game ? game.players[getOtherPlayerIndex(game)] : null),
    [game],
  );
  const deedOptions = useMemo(
    () =>
      BOARD_SPACES.filter(
        (space) =>
          space.type === "property" || space.type === "railroad" || space.type === "utility",
      ),
    [],
  );

  if (!import.meta.env.DEV) {
    return null;
  }

  const buttonStyle: CSSProperties = {
    width: "100%",
    border: "1px solid rgba(61, 43, 31, 0.15)",
    borderRadius: "10px",
    padding: "0.55rem 0.65rem",
    background: "rgba(255,255,255,0.9)",
    color: "#2f2417",
    textAlign: "left",
    cursor: "pointer",
    fontWeight: 700,
  };
  const compactButtonStyle: CSSProperties = {
    ...buttonStyle,
    textAlign: "center",
    padding: "0.45rem",
  };
  const inputStyle: CSSProperties = {
    width: "100%",
    border: "1px solid rgba(61, 43, 31, 0.15)",
    borderRadius: "10px",
    padding: "0.5rem 0.6rem",
    background: "rgba(255,255,255,0.9)",
    color: "#2f2417",
  };

  return (
    <div style={{ position: "fixed", top: 12, right: 12, zIndex: 1200 }}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        style={{
          border: "1px solid rgba(61, 43, 31, 0.15)",
          borderRadius: "999px",
          padding: "0.6rem 0.9rem",
          background: "#3D2B1F",
          color: "#fff",
          fontWeight: 900,
          letterSpacing: "0.04em",
          cursor: "pointer",
        }}
      >
        {open ? "Close Debug" : "Open Debug"}
      </button>

      {open ? (
        <div
          style={{
            marginTop: "0.5rem",
            width: "min(320px, calc(100vw - 24px))",
            maxHeight: "calc(100vh - 84px)",
            overflowY: "auto",
            borderRadius: "16px",
            padding: "0.9rem",
            background: "rgba(248, 242, 231, 0.95)",
            backdropFilter: "blur(10px)",
            boxShadow: "0 16px 40px rgba(0,0,0,0.18)",
            color: "#2f2417",
          }}
        >
          <div style={{ fontSize: "0.78rem", fontWeight: 900, marginBottom: "0.75rem" }}>
            Dev State Presets
          </div>

          {!game ? (
            <div style={{ display: "grid", gap: "0.5rem" }}>
              <button type="button" style={buttonStyle} onClick={() => startGame(DEBUG_PLAYERS)}>
                Quick Start 2 Players
              </button>
            </div>
          ) : (
            <div style={{ display: "grid", gap: "0.5rem" }}>
              <div style={{ fontSize: "0.72rem", opacity: 0.75 }}>
                {`Current: ${currentPlayer?.name ?? "n/a"} | Turn ${game.turn} | Phase ${game.phase}`}
              </div>

              <button
                type="button"
                style={buttonStyle}
                onClick={() =>
                  debugMutateGame((current) =>
                    withLog(
                      {
                        ...current,
                        currentPlayerIndex: getOtherPlayerIndex(current),
                        phase: "await_roll",
                      },
                      "Switched active player",
                    ),
                  )
                }
              >
                Switch Active Player
              </button>

              <div style={{ display: "grid", gap: "0.35rem" }}>
                <div style={{ fontSize: "0.72rem", fontWeight: 900, opacity: 0.8 }}>
                  Scenario Macros
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "0.35rem" }}>
                  <button
                    type="button"
                    style={buttonStyle}
                    onClick={() => debugMutateGame((current) => createRentTrap(current))}
                  >
                    Force Rent Trap
                  </button>
                  <button
                    type="button"
                    style={buttonStyle}
                    onClick={() => debugMutateGame((current) => createBankruptcyScenario(current))}
                  >
                    Force Bankruptcy
                  </button>
                  <button
                    type="button"
                    style={buttonStyle}
                    onClick={() =>
                      debugMutateGame((current) => createFullBuildCycleScenario(current))
                    }
                  >
                    Force Full Build Cycle
                  </button>
                </div>
              </div>

              <div style={{ display: "grid", gap: "0.35rem" }}>
                <div style={{ fontSize: "0.72rem", fontWeight: 900, opacity: 0.8 }}>Position</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "0.35rem" }}>
                  <select
                    value={jumpSpace}
                    onChange={(event) => setJumpSpace(event.target.value)}
                    style={inputStyle}
                  >
                    {BOARD_SPACES.map((space) => (
                      <option key={space.index} value={space.index}>
                        {`${space.index}: ${space.name}`}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    style={{ ...compactButtonStyle, minWidth: "74px" }}
                    onClick={() =>
                      debugMutateGame((current) => {
                        const nextPosition = Number(jumpSpace);
                        const player = current.players[current.currentPlayerIndex];

                        return withLog(
                          {
                            ...clearTransientState(current),
                            phase: "await_roll",
                            selectedSpace: nextPosition,
                            players: current.players.map((candidate) =>
                              candidate.id === player.id
                                ? {
                                    ...candidate,
                                    position: nextPosition,
                                    inJail: false,
                                    jailTurns: 0,
                                  }
                                : candidate,
                            ),
                          },
                          `Moved ${player.name} to ${BOARD_SPACES[nextPosition].name}`,
                        );
                      })
                    }
                  >
                    Jump
                  </button>
                </div>
              </div>

              <div style={{ display: "grid", gap: "0.35rem" }}>
                <div style={{ fontSize: "0.72rem", fontWeight: 900, opacity: 0.8 }}>Money</div>
                <div
                  style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: "0.35rem" }}
                >
                  <input
                    value={moneyValue}
                    onChange={(event) => setMoneyValue(event.target.value)}
                    inputMode="numeric"
                    style={inputStyle}
                  />
                  <button
                    type="button"
                    style={compactButtonStyle}
                    onClick={() =>
                      debugMutateGame((current) => {
                        const amount = Number(moneyValue);
                        const player = current.players[current.currentPlayerIndex];

                        return withLog(
                          {
                            ...current,
                            players: current.players.map((candidate) =>
                              candidate.id === player.id
                                ? { ...candidate, money: amount }
                                : candidate,
                            ),
                          },
                          `Set ${player.name} cash to $${amount}`,
                        );
                      })
                    }
                  >
                    Set
                  </button>
                  <button
                    type="button"
                    style={compactButtonStyle}
                    onClick={() =>
                      debugMutateGame((current) => {
                        const amount = Number(moneyValue);
                        const player = current.players[current.currentPlayerIndex];

                        return withLog(
                          {
                            ...current,
                            players: current.players.map((candidate) =>
                              candidate.id === player.id
                                ? { ...candidate, money: candidate.money + amount }
                                : candidate,
                            ),
                          },
                          `Adjusted ${player.name} cash by $${amount}`,
                        );
                      })
                    }
                  >
                    +/-
                  </button>
                </div>
              </div>

              <div style={{ display: "grid", gap: "0.35rem" }}>
                <div style={{ fontSize: "0.72rem", fontWeight: 900, opacity: 0.8 }}>Deeds</div>
                <select
                  value={propertyId}
                  onChange={(event) => setPropertyId(event.target.value)}
                  style={inputStyle}
                >
                  {deedOptions.map((space) => (
                    <option key={space.index} value={space.index}>
                      {space.name}
                    </option>
                  ))}
                </select>
                <div
                  style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "0.35rem" }}
                >
                  <button
                    type="button"
                    style={compactButtonStyle}
                    onClick={() =>
                      debugMutateGame((current) => {
                        const targetPropertyId = Number(propertyId);
                        const player = current.players[current.currentPlayerIndex];

                        return withLog(
                          {
                            ...current,
                            selectedSpace: targetPropertyId,
                            deeds: {
                              ...current.deeds,
                              [targetPropertyId]: {
                                ...current.deeds[targetPropertyId],
                                ownerId: player.id,
                                mortgaged: false,
                              },
                            },
                          },
                          `Assigned ${BOARD_SPACES[targetPropertyId].name} to ${player.name}`,
                        );
                      })
                    }
                  >
                    Give To Current
                  </button>
                  <button
                    type="button"
                    style={compactButtonStyle}
                    onClick={() =>
                      debugMutateGame((current) => {
                        const targetPropertyId = Number(propertyId);
                        const player = current.players[getOtherPlayerIndex(current)];

                        return withLog(
                          {
                            ...current,
                            selectedSpace: targetPropertyId,
                            deeds: {
                              ...current.deeds,
                              [targetPropertyId]: {
                                ...current.deeds[targetPropertyId],
                                ownerId: player.id,
                                mortgaged: false,
                              },
                            },
                          },
                          `Assigned ${BOARD_SPACES[targetPropertyId].name} to ${player.name}`,
                        );
                      })
                    }
                  >
                    Give To Opponent
                  </button>
                  <button
                    type="button"
                    style={compactButtonStyle}
                    onClick={() =>
                      debugMutateGame((current) => {
                        const targetPropertyId = Number(propertyId);

                        return withLog(
                          {
                            ...current,
                            selectedSpace: targetPropertyId,
                            deeds: {
                              ...current.deeds,
                              [targetPropertyId]: {
                                ...current.deeds[targetPropertyId],
                                ownerId: null,
                                houses: 0,
                                hotel: false,
                                mortgaged: false,
                              },
                            },
                          },
                          `Cleared ownership on ${BOARD_SPACES[targetPropertyId].name}`,
                        );
                      })
                    }
                  >
                    Clear Deed
                  </button>
                  <button
                    type="button"
                    style={compactButtonStyle}
                    onClick={() =>
                      debugMutateGame((current) => {
                        const targetPropertyId = Number(propertyId);
                        const deed = current.deeds[targetPropertyId];

                        return withLog(
                          {
                            ...current,
                            selectedSpace: targetPropertyId,
                            deeds: {
                              ...current.deeds,
                              [targetPropertyId]: {
                                ...deed,
                                mortgaged: !deed.mortgaged,
                              },
                            },
                          },
                          `${deed.mortgaged ? "Unmortgaged" : "Mortgaged"} ${BOARD_SPACES[targetPropertyId].name}`,
                        );
                      })
                    }
                  >
                    Toggle Mortgage
                  </button>
                </div>
              </div>

              <div style={{ display: "grid", gap: "0.35rem" }}>
                <div style={{ fontSize: "0.72rem", fontWeight: 900, opacity: 0.8 }}>
                  Deterministic Rolls
                </div>
                <div
                  style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.35rem" }}
                >
                  <button type="button" style={compactButtonStyle} onClick={() => debugRoll(1, 1)}>
                    1 + 1
                  </button>
                  <button type="button" style={compactButtonStyle} onClick={() => debugRoll(3, 3)}>
                    3 + 3
                  </button>
                  <button type="button" style={compactButtonStyle} onClick={() => debugRoll(6, 6)}>
                    6 + 6
                  </button>
                  <button type="button" style={compactButtonStyle} onClick={() => debugRoll(1, 2)}>
                    1 + 2
                  </button>
                  <button type="button" style={compactButtonStyle} onClick={() => debugRoll(2, 4)}>
                    2 + 4
                  </button>
                  <button type="button" style={compactButtonStyle} onClick={() => debugRoll(5, 6)}>
                    5 + 6
                  </button>
                </div>
              </div>

              <button
                type="button"
                style={buttonStyle}
                onClick={() =>
                  debugMutateGame((current) =>
                    withLog(
                      {
                        ...clearTransientState(current),
                        phase: "await_purchase",
                        selectedSpace: 1,
                        pendingPurchase: { propertyId: 1 },
                      },
                      "Forced purchase modal on Mediterranean Avenue",
                    ),
                  )
                }
              >
                Force Purchase Modal
              </button>

              <button
                type="button"
                style={buttonStyle}
                onClick={() =>
                  debugMutateGame((current) =>
                    withLog(
                      {
                        ...clearTransientState(current),
                        phase: "auction",
                        selectedSpace: 5,
                        pendingAuction: createAuction(current, 5),
                      },
                      "Forced auction on Reading Railroad",
                    ),
                  )
                }
              >
                Force Auction
              </button>

              <button
                type="button"
                style={buttonStyle}
                onClick={() =>
                  debugMutateGame((current) => {
                    const player = current.players[current.currentPlayerIndex];

                    return withLog(
                      {
                        ...clearTransientState(current),
                        phase: "manage_debt",
                        players: current.players.map((candidate) =>
                          candidate.id === player.id ? { ...candidate, money: 20 } : candidate,
                        ),
                        deeds: {
                          ...current.deeds,
                          1: {
                            ...current.deeds[1],
                            ownerId: player.id,
                            houses: 0,
                            hotel: false,
                            mortgaged: false,
                          },
                        },
                        selectedSpace: 1,
                        pendingDebt: {
                          payerId: player.id,
                          amount: 120,
                          recipientId: null,
                          reason: "debug debt scenario",
                        },
                      },
                      "Forced debt scenario with one mortgageable deed",
                    );
                  })
                }
              >
                Force Debt
              </button>

              <button
                type="button"
                style={buttonStyle}
                onClick={() =>
                  debugMutateGame((current) => {
                    const player = current.players[current.currentPlayerIndex];

                    return withLog(
                      {
                        ...clearTransientState(current),
                        phase: "await_roll",
                        selectedSpace: 10,
                        players: current.players.map((candidate) =>
                          candidate.id === player.id
                            ? { ...candidate, position: 10, inJail: true, jailTurns: 0 }
                            : candidate,
                        ),
                      },
                      "Sent current player to Jail",
                    );
                  })
                }
              >
                Send Current Player To Jail
              </button>

              <button
                type="button"
                style={buttonStyle}
                onClick={() =>
                  debugMutateGame((current) => {
                    const player = current.players[current.currentPlayerIndex];

                    return withLog(
                      {
                        ...current,
                        players: current.players.map((candidate) =>
                          candidate.id === player.id
                            ? {
                                ...candidate,
                                getOutOfJailCards: [...candidate.getOutOfJailCards, "chance"],
                              }
                            : candidate,
                        ),
                      },
                      "Granted Get Out of Jail Free card",
                    );
                  })
                }
              >
                Grant Get Out Of Jail Card
              </button>

              <button
                type="button"
                style={buttonStyle}
                onClick={() =>
                  debugMutateGame((current) => showCard(current, "chance", "chance-go-to-jail"))
                }
              >
                Force Chance Card
              </button>

              <button
                type="button"
                style={buttonStyle}
                onClick={() =>
                  debugMutateGame((current) =>
                    showCard(current, "communityChest", "chest-birthday"),
                  )
                }
              >
                Force Community Chest Card
              </button>

              <button
                type="button"
                style={buttonStyle}
                onClick={() =>
                  debugMutateGame((current) => {
                    const player = current.players[current.currentPlayerIndex];

                    return withLog(
                      {
                        ...clearTransientState(current),
                        phase: "await_end_turn",
                        selectedSpace: 1,
                        players: current.players.map((candidate) =>
                          candidate.id === player.id ? { ...candidate, money: 1500 } : candidate,
                        ),
                        deeds: {
                          ...current.deeds,
                          1: {
                            ...current.deeds[1],
                            ownerId: player.id,
                            houses: 0,
                            hotel: false,
                            mortgaged: false,
                          },
                          3: {
                            ...current.deeds[3],
                            ownerId: player.id,
                            houses: 0,
                            hotel: false,
                            mortgaged: false,
                          },
                        },
                      },
                      "Granted full brown set for build/sell tests",
                    );
                  })
                }
              >
                Grant Buildable Color Set
              </button>

              <button
                type="button"
                style={buttonStyle}
                onClick={() =>
                  debugMutateGame((current) => {
                    const player = current.players[current.currentPlayerIndex];
                    const loserIndex = getOtherPlayerIndex(current);
                    const loser = current.players[loserIndex];

                    return withLog(
                      {
                        ...clearTransientState(current),
                        currentPlayerIndex: current.players.findIndex(
                          (candidate) => candidate.id === player.id,
                        ),
                        phase: "game_over",
                        winnerId: player.id,
                        players: current.players.map((candidate) =>
                          candidate.id === loser.id
                            ? { ...candidate, bankrupt: true, money: 0 }
                            : candidate,
                        ),
                      },
                      "Forced win state",
                    );
                  })
                }
              >
                Force Win State
              </button>

              <button
                type="button"
                style={{ ...buttonStyle, background: "#f8d7da", color: "#7b1e28" }}
                onClick={clearSavedGame}
              >
                Reset To Setup
              </button>
            </div>
          )}

          {otherPlayer ? (
            <div style={{ marginTop: "0.75rem", fontSize: "0.7rem", opacity: 0.68 }}>
              {`Opponent: ${otherPlayer.name}`}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
