import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import { GameBoard } from "./components/GameBoard";
import { SetupScreen } from "./components/SetupScreen";
import { LeftSidebar, RightSidebar } from "./components/Sidebar";
import { DebugPanel } from "./components/DebugPanel";
import { useGameStore } from "./game/store";
import { getPropertyDetailsSummary, getSpace } from "./game/selectors";
import { playSound, soundForLogEntry } from "./game/audio";
import type { GameState } from "./game/types";

const Celebration = lazy(async () => {
  const module = await import("./components/Celebration");
  return { default: module.Celebration };
});

function useSoundEffects(game: GameState | null) {
  const logLenRef = useRef(0);
  const prevPhaseRef = useRef<string | null>(null);
  const prevDiceRef = useRef<string | null>(null);
  const prevStepsRef = useRef<number | null>(null);

  useEffect(() => {
    if (!game) return;

    // Log-based sounds
    if (game.log.length > logLenRef.current) {
      const sound = soundForLogEntry(game.log.at(-1) ?? "");
      if (sound) playSound(sound);
      logLenRef.current = game.log.length;
    }

    // Doubles detection (after dice roll)
    if (game.dice) {
      const key = game.dice.join(",");
      if (key !== prevDiceRef.current) {
        prevDiceRef.current = key;
        if (game.dice[0] === game.dice[1]) {
          setTimeout(() => playSound("doubles"), 350);
        }
      }
    }

    // Card draw on phase change
    if (game.phase === "show_card" && prevPhaseRef.current !== "show_card") {
      playSound("cardDraw");
    }
    prevPhaseRef.current = game.phase;

    // Movement step sounds
    if (game.phase === "moving" && game.move) {
      if (game.move.stepsRemaining !== prevStepsRef.current) {
        prevStepsRef.current = game.move.stepsRemaining;
        playSound("movementStep");
      }
    } else {
      prevStepsRef.current = null;
    }
  }, [game]);
}

function App() {
  const {
    game,
    hasSavedGame,
    startGame,
    loadSavedGame,
    clearSavedGame,
    advanceMovement,
    buyProperty,
    declineProperty,
    acknowledgeCard,
  } = useGameStore();

  useSoundEffects(game);

  const [toast, setToast] = useState<{ id: number; message: string } | null>(null);
  const logLengthRef = useRef(0);
  const showToastTimerRef = useRef<number | undefined>(undefined);
  const toastTimerRef = useRef<number | undefined>(undefined);
  const latestLogEntry = useMemo(() => game?.log.at(-1) ?? null, [game?.log]);

  // Auto-advance movement
  useEffect(() => {
    if (!game || game.phase !== "moving" || !game.move) {
      return undefined;
    }

    const timeout = window.setTimeout(() => {
      advanceMovement();
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [game, advanceMovement]);

  // Toast notifications for game log
  useEffect(() => {
    if (!game || game.log.length === 0 || !latestLogEntry) return;
    if (game.log.length <= logLengthRef.current) {
      logLengthRef.current = game.log.length;
      return;
    }
    const nextToast = {
      id: game.log.length,
      message: latestLogEntry,
    };

    logLengthRef.current = game.log.length;
    window.clearTimeout(showToastTimerRef.current);
    window.clearTimeout(toastTimerRef.current);
    showToastTimerRef.current = window.setTimeout(() => {
      setToast(nextToast);
      toastTimerRef.current = window.setTimeout(() => setToast(null), 3000);
    }, 0);

    return () => {
      window.clearTimeout(showToastTimerRef.current);
    };
  }, [game, latestLogEntry]);

  useEffect(
    () => () => {
      window.clearTimeout(showToastTimerRef.current);
      window.clearTimeout(toastTimerRef.current);
    },
    [],
  );

  if (!game) {
    return (
      <SetupScreen
        hasSavedGame={hasSavedGame}
        onStart={startGame}
        onLoadSaved={loadSavedGame}
        onClearSaved={clearSavedGame}
      />
    );
  }

  const currentPlayer = game.players[game.currentPlayerIndex];
  const pendingPurchaseSpace = game.pendingPurchase
    ? getSpace(game.pendingPurchase.propertyId)
    : null;
  const winnerName = game.players.find((player) => player.id === game.winnerId)?.name;
  const pendingPurchasePrice =
    pendingPurchaseSpace && "price" in pendingPurchaseSpace ? pendingPurchaseSpace.price : null;
  const remainingCashAfterPurchase =
    pendingPurchasePrice === null ? null : currentPlayer.money - pendingPurchasePrice;

  return (
    <>
      <DebugPanel />
      <div className="app-shell">
        <LeftSidebar />
        <main className="main-content">
          <GameBoard />
        </main>
        <RightSidebar />
      </div>

      {toast && <div className="toast glass nm-flat">{toast.message}</div>}

      {/* Modern Glassmorphism Modals */}
      {game.phase === "await_purchase" && pendingPurchaseSpace && (
        <div className="modal-overlay">
          <div className="modal-content glass nm-convex">
            <h2 className="modal-title">Buy {pendingPurchaseSpace.name}?</h2>
            <div className="modal-body">
              <p>{getPropertyDetailsSummary(game, pendingPurchaseSpace.index)}</p>
              {"rent" in pendingPurchaseSpace ? (
                <p className="muted-text">{`Rent scale: ${pendingPurchaseSpace.rent.join(" / ")}`}</p>
              ) : (
                <p className="muted-text">
                  Railroads and utilities have dynamic rent based on ownership and dice.
                </p>
              )}
              {pendingPurchasePrice !== null ? (
                <>
                  <p className="muted-text">{`Cost: $${pendingPurchasePrice}`}</p>
                  <p className="muted-text">
                    {remainingCashAfterPurchase !== null && remainingCashAfterPurchase >= 0
                      ? `Cash after purchase: $${remainingCashAfterPurchase}`
                      : "You cannot currently afford this property."}
                  </p>
                </>
              ) : null}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn-nm" onClick={declineProperty}>
                Decline
              </button>
              <button
                type="button"
                className="btn-nm btn-primary"
                onClick={buyProperty}
                disabled={
                  !("price" in pendingPurchaseSpace) ||
                  currentPlayer.money < pendingPurchaseSpace.price
                }
              >
                {"price" in pendingPurchaseSpace ? `Buy ($${pendingPurchaseSpace.price})` : "Buy"}
              </button>
            </div>
          </div>
        </div>
      )}

      {game.phase === "show_card" && game.pendingCard && (
        <div className="modal-overlay">
          <div className="modal-content glass nm-convex">
            <h2 className="modal-title">
              {game.pendingCard.deck === "chance" ? "Chance" : "Community Chest"}
            </h2>
            <div className="modal-body">
              <p>{game.pendingCard.description}</p>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn-nm btn-primary" onClick={acknowledgeCard}>
                Resolve
              </button>
            </div>
          </div>
        </div>
      )}

      {game.winnerId && (
        <>
          <Suspense fallback={null}>
            <Celebration />
          </Suspense>
          <div className="modal-overlay">
            <div className="modal-content glass nm-convex">
              <h2 className="modal-title">Game Over</h2>
              <div className="modal-body">
                <p>{winnerName} wins!</p>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-nm btn-primary" onClick={clearSavedGame}>
                  New Game
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}

export default App;
