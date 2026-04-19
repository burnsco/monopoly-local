import { colorGroupColor, colorGroupLabel } from "../game/data/board";
import { getPlayerById, getPropertyDetailsSummary, getSpace } from "../game/selectors";
import { useGameStore } from "../game/store";
import { PropertyManager } from "./PropertyManager";
import { TokenIcon } from "./TokenIcon";
import { DiceDisplay } from "./Dice";

const PHASE_MESSAGES: Record<string, string> = {
  await_roll: "Your Turn",
  moving: "Moving...",
  await_purchase: "Purchase Property?",
  show_card: "Action Card",
  auction: "Auction!",
  manage_debt: "Financial Trouble",
  await_end_turn: "Turn Over",
  game_over: "Victory!",
};

export function LeftSidebar() {
  const { game, buildHouse, sellBuilding, mortgage, unmortgage, setSelectedSpace } = useGameStore();

  if (!game) return null;

  const currentPlayer = game.players[game.currentPlayerIndex];

  return (
    <aside className="left-sidebar">
      <section className="sidebar-section">
        <div className="section-heading">
          <h3>Players</h3>
        </div>
        <div className="player-list">
          {game.players.map((player) => {
            const isActive = player.id === currentPlayer.id;
            return (
              <div
                key={player.id}
                className={`player-card ${isActive ? "active" : ""} ${player.bankrupt ? "bankrupt" : ""}`}
              >
                <div className="player-info">
                  <div className="player-token-large" style={{ background: player.color }}>
                    <TokenIcon name={player.token} size={20} />
                  </div>
                  <div className="player-meta">
                    <div className="player-name">{player.name}</div>
                    <div className="player-money">${player.money}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="sidebar-section scroll nm-inset">
        <PropertyManager
          game={game}
          onBuild={buildHouse}
          onSell={sellBuilding}
          onMortgage={mortgage}
          onUnmortgage={unmortgage}
          onSelectProperty={setSelectedSpace}
        />
      </section>
    </aside>
  );
}

export function RightSidebar() {
  const {
    game,
    diceRolling,
    rollDice,
    endTurn,
    payBail,
    playGetOutOfJailCard,
    settleDebt,
    declareBankruptcy,
    placeBid,
    passAuction,
  } = useGameStore();

  if (!game) return null;

  const currentPlayer = game.players[game.currentPlayerIndex];
  const pendingAuction = game.pendingAuction;
  const selectedSpace = game.selectedSpace !== null ? getSpace(game.selectedSpace) : null;
  const activeBidder = pendingAuction
    ? (getPlayerById(game, pendingAuction.activePlayerId) ?? null)
    : null;
  const highestBidderId = pendingAuction?.highestBidderId ?? null;
  const highestBidder = highestBidderId ? (getPlayerById(game, highestBidderId) ?? null) : null;
  const auctionSpace = pendingAuction ? getSpace(pendingAuction.propertyId) : null;
  const reversedLog = game.log.map((entry, index) => ({ entry, key: `log-${index}` })).toReversed();
  const jailStatus = currentPlayer.inJail
    ? `Attempt ${Math.min(currentPlayer.jailTurns + 1, 3)} of 3 to roll doubles`
    : null;

  return (
    <aside className="right-sidebar">
      {/* Turn + Dice */}
      <section className="turn-panel glass nm-flat">
        <div className="turn-header">
          <div
            className="player-token-large active-turn-pulse"
            style={{ background: currentPlayer.color }}
          >
            <TokenIcon name={currentPlayer.token} size={24} />
          </div>
          <div className="turn-header-meta">
            <div className="turn-header-phase">{PHASE_MESSAGES[game.phase] || game.phase}</div>
            <div className="turn-header-name">{currentPlayer.name}</div>
            <div className="turn-header-sub">
              {`Turn ${game.turn}`}
              {game.lastRollTotal !== null ? ` · Last roll ${game.lastRollTotal}` : ""}
              {game.extraTurn && game.phase === "await_end_turn" ? " · Extra turn" : ""}
            </div>
          </div>
        </div>

        <div className="dice-row">
          <DiceDisplay values={game.dice || [1, 1]} rolling={diceRolling} />
          <div className="dashboard-actions">
            {game.phase === "await_roll" && (
              <button className="btn-nm btn-primary" onClick={rollDice} disabled={diceRolling}>
                Roll
              </button>
            )}
            {game.phase === "await_end_turn" && (
              <button className="btn-nm" onClick={endTurn}>
                End Turn
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Contextual: jail */}
      {currentPlayer.inJail && game.phase === "await_roll" && (
        <section className="context-panel glass nm-convex">
          <div className="context-panel-title">In Jail</div>
          {jailStatus && <div className="context-panel-body">{jailStatus}</div>}
          <div className="context-panel-actions">
            <button
              className="btn-nm btn-compact"
              onClick={payBail}
              disabled={currentPlayer.money < game.settings.bailAmount}
            >
              {`Pay $${game.settings.bailAmount}`}
            </button>
            <button
              className="btn-nm btn-compact"
              onClick={playGetOutOfJailCard}
              disabled={currentPlayer.getOutOfJailCards.length === 0}
            >
              Use Card
            </button>
          </div>
        </section>
      )}

      {/* Contextual: debt */}
      {game.phase === "manage_debt" && game.pendingDebt && (
        <section className="context-panel debt glass nm-convex">
          <div className="context-panel-title">Debt · ${game.pendingDebt.amount}</div>
          <div className="context-panel-body">{game.pendingDebt.reason}</div>
          <div className="context-panel-actions">
            <button
              className="btn-nm btn-primary btn-compact"
              onClick={settleDebt}
              disabled={currentPlayer.money < game.pendingDebt.amount}
            >
              Pay
            </button>
            <button className="btn-nm btn-danger btn-compact" onClick={declareBankruptcy}>
              Bankrupt
            </button>
          </div>
        </section>
      )}

      {/* Contextual: auction */}
      {game.phase === "auction" && game.pendingAuction && activeBidder && (
        <section className="context-panel glass nm-convex">
          <div className="context-panel-title">
            {`Auction · ${auctionSpace?.name ?? "Property"}`}
          </div>
          <div className="context-panel-body">
            {`Current bid: $${game.pendingAuction.highestBid}`}
            {highestBidder ? ` · Leader: ${highestBidder.name}` : " · No bids yet"}
          </div>
          <div className="context-panel-actions">
            {activeBidder.id === currentPlayer.id ? (
              <>
                <button
                  className="btn-nm btn-compact"
                  onClick={() => placeBid(game.pendingAuction!.highestBid + 10)}
                  disabled={currentPlayer.money < game.pendingAuction!.highestBid + 10}
                >
                  +$10
                </button>
                <button
                  className="btn-nm btn-compact"
                  onClick={() => placeBid(game.pendingAuction!.highestBid + 50)}
                  disabled={currentPlayer.money < game.pendingAuction!.highestBid + 50}
                >
                  +$50
                </button>
                <button className="btn-nm btn-compact" onClick={passAuction}>
                  Pass
                </button>
              </>
            ) : (
              <span className="context-panel-body">{`${activeBidder.name} is bidding`}</span>
            )}
          </div>
        </section>
      )}

      {/* Selected Space details */}
      {selectedSpace && (
        <section className="selected-space glass nm-flat">
          <div className="selected-space-header">
            <h4>{selectedSpace.name}</h4>
            {selectedSpace.type === "property" && (
              <span
                className="selected-space-pill"
                style={{ background: colorGroupColor[selectedSpace.colorGroup] }}
              >
                {colorGroupLabel[selectedSpace.colorGroup]}
              </span>
            )}
          </div>
          <p>{getPropertyDetailsSummary(game, selectedSpace.index)}</p>
        </section>
      )}

      {/* Log */}
      <section className="log-panel nm-inset">
        <div className="section-heading">
          <h3>Log</h3>
        </div>
        <div className="log-container">
          {reversedLog.map(({ entry, key }) => (
            <div key={key} className="log-entry">
              {entry}
            </div>
          ))}
        </div>
      </section>
    </aside>
  );
}
