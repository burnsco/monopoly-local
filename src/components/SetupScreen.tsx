import { useMemo, useState } from 'react'
import { COLOR_OPTIONS, TOKEN_OPTIONS } from '../game/setup'
import type { PlayerSetup } from '../game/types'
import { TokenIcon } from './TokenIcon'

interface SetupScreenProps {
  hasSavedGame: boolean
  onStart: (players: PlayerSetup[]) => void
  onLoadSaved: () => void
  onClearSaved: () => void
}

function createDefaults(count: number): PlayerSetup[] {
  return Array.from({ length: count }, (_, index) => ({
    name: `Player ${index + 1}`,
    token: TOKEN_OPTIONS[index],
    color: COLOR_OPTIONS[index],
  }))
}

function resizePlayers(players: PlayerSetup[], count: number): PlayerSetup[] {
  const defaults = createDefaults(count)
  return defaults.map((fallback, index) => players[index] ?? fallback)
}

export function SetupScreen({ hasSavedGame, onStart, onLoadSaved, onClearSaved }: SetupScreenProps) {
  const [playerCount, setPlayerCount] = useState(4)
  const [players, setPlayers] = useState<PlayerSetup[]>(() => createDefaults(4))

  const tokensUnique = useMemo(() => new Set(players.map((p) => p.token)).size === players.length, [players])
  const colorsUnique = useMemo(() => new Set(players.map((p) => p.color)).size === players.length, [players])
  const canStart = tokensUnique && colorsUnique && players.length >= 2

  function updatePlayer(index: number, changes: Partial<PlayerSetup>) {
    setPlayers((current) => current.map((player, playerIndex) => (
      playerIndex === index ? { ...player, ...changes } : player
    )))
  }

  return (
    <div className="setup-screen nm-flat">
      <div className="setup-hero">
        <h1 className="center-logo" style={{ fontSize: '5rem', marginBottom: '1rem' }}>MONOPOLY</h1>
        <p className="eyebrow">The Grandest Avenue • Premier Edition</p>
        <p className="setup-copy" style={{ maxWidth: '600px', margin: '0 auto', fontSize: '1.1rem', opacity: 0.8 }}>
          Experience the classic game of strategy and risk in a stunning new light.
        </p>
      </div>

      <div className="setup-panel glass nm-convex" style={{ padding: '3rem', borderRadius: '40px', maxWidth: '1000px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <div className="field">
            <span style={{ fontSize: '1.2rem', fontWeight: 700 }}>Player Count</span>
            <select
              className="btn-nm"
              style={{ padding: '0.5rem 1rem' }}
              value={playerCount}
              onChange={(e) => {
                const nextCount = Number(e.target.value)
                setPlayerCount(nextCount)
                setPlayers((current) => resizePlayers(current, nextCount))
              }}
            >
              {[2, 3, 4, 5, 6, 7, 8].map(n => <option key={n} value={n}>{n} Players</option>)}
            </select>
          </div>

          <div style={{ display: 'flex', gap: '1rem' }}>
            {hasSavedGame && (
              <>
                <button className="btn-nm" onClick={onLoadSaved}>Resume Game</button>
                <button className="btn-nm btn-danger" onClick={onClearSaved}>Clear Save</button>
              </>
            )}
          </div>
        </div>

        <div className="setup-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '2rem' }}>
          {players.map((player, index) => {
            const takenTokens = players.filter((_, i) => i !== index).map(p => p.token)
            const takenColors = players.filter((_, i) => i !== index).map(p => p.color)

            return (
              <div key={index} className="setup-card nm-flat" style={{ padding: '1.5rem', borderRadius: '25px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 900, opacity: 0.5 }}>#{index + 1}</span>
                  <div className="player-token-large" style={{ background: player.color, width: '40px', height: '40px' }}>
                    <TokenIcon name={player.token} size={20} />
                  </div>
                </div>

                <div className="field">
                  <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>Name</span>
                  <input
                    className="nm-inset"
                    style={{ background: 'transparent', border: 'none', padding: '0.8rem', borderRadius: '15px', color: 'var(--nm-text)', fontWeight: 700 }}
                    value={player.name}
                    onChange={(e) => updatePlayer(index, { name: e.target.value })}
                    maxLength={18}
                  />
                </div>

                <div className="field">
                  <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>Token</span>
                  <select
                    className="nm-inset"
                    style={{ background: 'transparent', border: 'none', padding: '0.8rem', borderRadius: '15px', color: 'var(--nm-text)', fontWeight: 700 }}
                    value={player.token}
                    onChange={(e) => updatePlayer(index, { token: e.target.value })}
                  >
                    {TOKEN_OPTIONS.map(token => (
                      <option key={token} value={token} disabled={takenTokens.includes(token)}>{token}</option>
                    ))}
                  </select>
                </div>

                <div className="field">
                  <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>Color</span>
                  <select
                    className="nm-inset"
                    style={{ background: 'transparent', border: 'none', padding: '0.8rem', borderRadius: '15px', color: 'var(--nm-text)', fontWeight: 700 }}
                    value={player.color}
                    onChange={(e) => updatePlayer(index, { color: e.target.value })}
                  >
                    {COLOR_OPTIONS.map(color => (
                      <option key={color} value={color} disabled={takenColors.includes(color)}>{color}</option>
                    ))}
                  </select>
                </div>
              </div>
            )
          })}
        </div>

        <div style={{ marginTop: '3rem', textAlign: 'center' }}>
          {(!tokensUnique || !colorsUnique) && <p style={{ color: '#e53e3e', marginBottom: '1rem' }}>Each player needs a unique token and color.</p>}
          <button className="btn-nm btn-primary" style={{ padding: '1.5rem 4rem', fontSize: '1.2rem' }} disabled={!canStart} onClick={() => onStart(players)}>
            Begin Grand Avenue
          </button>
        </div>
      </div>
    </div>
  )
}
