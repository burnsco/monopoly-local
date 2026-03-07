import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import { GameBoard } from './components/GameBoard'
import { SetupScreen } from './components/SetupScreen'
import { LeftSidebar, BottomBar } from './components/Sidebar'
import { useGameStore } from './game/store'
import { getPropertyDetailsSummary, getSpace } from './game/selectors'

const Celebration = lazy(async () => {
  const module = await import('./components/Celebration')
  return { default: module.Celebration }
})

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
  } = useGameStore()

  const [toast, setToast] = useState<{ id: number; message: string } | null>(null)
  const logLengthRef = useRef(0)
  const showToastTimerRef = useRef<number | undefined>(undefined)
  const toastTimerRef = useRef<number | undefined>(undefined)
  const latestLogEntry = useMemo(() => game?.log.at(-1) ?? null, [game?.log])

  // Auto-advance movement
  useEffect(() => {
    if (!game || game.phase !== 'moving' || !game.move) {
      return undefined
    }

    const timeout = window.setTimeout(() => {
      advanceMovement()
    }, 250)

    return () => window.clearTimeout(timeout)
  }, [game, advanceMovement])

  // Toast notifications for game log
  useEffect(() => {
    if (!game || game.log.length === 0 || !latestLogEntry) return
    if (game.log.length <= logLengthRef.current) {
      logLengthRef.current = game.log.length
      return
    }
    const nextToast = {
      id: game.log.length,
      message: latestLogEntry,
    }

    logLengthRef.current = game.log.length
    window.clearTimeout(showToastTimerRef.current)
    window.clearTimeout(toastTimerRef.current)
    showToastTimerRef.current = window.setTimeout(() => {
      setToast(nextToast)
      toastTimerRef.current = window.setTimeout(() => setToast(null), 3000)
    }, 0)

    return () => {
      window.clearTimeout(showToastTimerRef.current)
    }
  }, [game, latestLogEntry])

  useEffect(() => () => {
    window.clearTimeout(showToastTimerRef.current)
    window.clearTimeout(toastTimerRef.current)
  }, [])

  if (!game) {
    return (
      <SetupScreen
        hasSavedGame={hasSavedGame}
        onStart={startGame}
        onLoadSaved={loadSavedGame}
        onClearSaved={clearSavedGame}
      />
    )
  }

  const currentPlayer = game.players[game.currentPlayerIndex]
  const pendingPurchaseSpace = game.pendingPurchase ? getSpace(game.pendingPurchase.propertyId) : null
  const winnerName = game.players.find((player) => player.id === game.winnerId)?.name

  return (
    <>
      <div className="app-shell">
        <LeftSidebar />
        <main className="main-content">
          <GameBoard />
          <BottomBar />
        </main>
      </div>

      {toast && (
        <div className="toast glass nm-flat">
          {toast.message}
        </div>
      )}

      {/* Modern Glassmorphism Modals */}
      {game.phase === 'await_purchase' && pendingPurchaseSpace && (
        <div className="modal-overlay">
          <div className="modal-content glass nm-convex">
            <h2 className="modal-title">Buy {pendingPurchaseSpace.name}?</h2>
            <div className="modal-body">
              <p>{getPropertyDetailsSummary(game, pendingPurchaseSpace.index)}</p>
              {'rent' in pendingPurchaseSpace ? (
                <p className="muted-text">{`Rent scale: ${pendingPurchaseSpace.rent.join(' / ')}`}</p>
              ) : (
                <p className="muted-text">Railroads and utilities have dynamic rent based on ownership and dice.</p>
              )}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn-nm" onClick={declineProperty}>
                Decline
              </button>
              <button
                type="button"
                className="btn-nm btn-primary"
                onClick={buyProperty}
                disabled={!('price' in pendingPurchaseSpace) || currentPlayer.money < pendingPurchaseSpace.price}
              >
                {'price' in pendingPurchaseSpace ? `Buy ($${pendingPurchaseSpace.price})` : 'Buy'}
              </button>
            </div>
          </div>
        </div>
      )}

      {game.phase === 'show_card' && game.pendingCard && (
        <div className="modal-overlay">
          <div className="modal-content glass nm-convex">
            <h2 className="modal-title">{game.pendingCard.deck === 'chance' ? 'Chance' : 'Community Chest'}</h2>
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
  )
}

export default App
