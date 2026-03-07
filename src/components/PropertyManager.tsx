import { colorGroupColor, colorGroupLabel } from '../game/data/board'
import { getBuildActions, getGroupStatus } from '../game/engine'
import { getOwnedPropertyIds, getPropertyLevel, getSpace } from '../game/selectors'
import type { GameState } from '../game/types'

interface PropertyManagerProps {
  game: GameState
  onBuild: (propertyId: number) => void
  onSell: (propertyId: number) => void
  onMortgage: (propertyId: number) => void
  onUnmortgage: (propertyId: number) => void
  onSelectProperty: (propertyId: number) => void
}

export function PropertyManager({
  game,
  onBuild,
  onSell,
  onMortgage,
  onUnmortgage,
  onSelectProperty,
}: PropertyManagerProps) {
  const currentPlayer = game.players[game.currentPlayerIndex]
  const propertyIds = getOwnedPropertyIds(game, currentPlayer.id)

  if (propertyIds.length === 0) {
    return (
      <section className="sidebar-card">
        <div className="section-heading">
          <h3>PROPERTIES</h3>
        </div>
        <p className="muted-text">No deeds yet.</p>
      </section>
    )
  }

  return (
    <section className="sidebar-card">
      <div className="section-heading">
        <h3>PROPERTIES</h3>
      </div>

      <div className="property-stack">
        {propertyIds.map((propertyId) => {
          const property = getSpace(propertyId)
          const deed = game.deeds[propertyId]
          const actions = getBuildActions(game, propertyId)
          const level = getPropertyLevel(deed)

          return (
            <article key={propertyId} className="property-card">
              <button type="button" className="property-card-main" onClick={() => onSelectProperty(propertyId)}>
                <div className="property-card-header">
                  <div className="property-swatch" style={{ background: property.type === 'property' ? colorGroupColor[property.colorGroup] : '#5f6b88' }} />
                  <div>
                    <strong>{property.name}</strong>
                    <p className="muted-text">
                      {property.type === 'property'
                        ? `${colorGroupLabel[property.colorGroup]} | ${getGroupStatus(game, property.colorGroup, currentPlayer.id)}`
                        : property.type === 'railroad'
                          ? 'Railroad'
                          : 'Utility'}
                    </p>
                  </div>
                </div>
                <div className="property-status-row">
                  <span>{deed.mortgaged ? 'Mortgaged' : `Level ${level}`}</span>
                  {'price' in property ? <span>{`Value $${property.price}`}</span> : null}
                </div>
              </button>

              <div className="property-actions">
                {property.type === 'property' ? (
                  <>
                    <button type="button" className="mini-button" onClick={() => onBuild(propertyId)} disabled={!actions.canBuild}>
                      Build
                    </button>
                    <button type="button" className="mini-button" onClick={() => onSell(propertyId)} disabled={!actions.canSell}>
                      Sell
                    </button>
                  </>
                ) : null}
                <button type="button" className="mini-button" onClick={() => onMortgage(propertyId)} disabled={!actions.canMortgage}>
                  Mortgage
                </button>
                <button type="button" className="mini-button" onClick={() => onUnmortgage(propertyId)} disabled={!actions.canUnmortgage}>
                  Unmortgage
                </button>
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}
