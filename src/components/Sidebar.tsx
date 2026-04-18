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
      {/* Players Grid */}
      <section className="sidebar-section">
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
                    <TokenIcon name={player.token} size={26} />
                  </div>
                  <div className="player-name">{player.name}</div>
                  <div className="player-money">${player.money}</div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Property Management */}
      <section
        className="sidebar-section nm-inset"
        style={{ padding: "1rem", borderRadius: "20px", flexGrow: 1, overflowY: "auto" }}
      >
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

export function BottomBar() {
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
  const latestLogEntry = game.log.at(-1) ?? null;
  const jailStatus = currentPlayer.inJail
    ? `Attempt ${Math.min(currentPlayer.jailTurns + 1, 3)} of 3 to roll doubles`
    : null;

  return (
    <footer className="bottom-bar">
      {/* Controls & Dice */}
      <section className="bottom-section controls-section glass nm-flat">
        <div className="status-indicator">
          <div
            className="player-token-large active-turn-pulse"
            style={{ background: currentPlayer.color }}
          >
            <TokenIcon name={currentPlayer.token} size={28} />
          </div>
          <div style={{ textAlign: "left" }}>
            <div
              className="eyebrow"
              style={{
                color: "var(--metallic-gold)",
                background: "none",
                padding: 0,
                margin: 0,
                fontSize: "0.6rem",
              }}
            >
              {PHASE_MESSAGES[game.phase] || game.phase}
            </div>
            <div style={{ fontWeight: 900, fontSize: "0.8rem" }}>{currentPlayer.name}</div>
          </div>
        </div>

        <div className="dice-controls">
          <DiceDisplay values={game.dice || [1, 1]} rolling={diceRolling} />
          <div className="dashboard-actions">
            {game.phase === "await_roll" && (
              <button className="btn-nm btn-primary" onClick={rollDice} disabled={diceRolling}>
                Roll
              </button>
            )}
            {game.phase === "await_end_turn" && (
              <button className="btn-nm" onClick={endTurn}>
                End
              </button>
            )}
          </div>
        </div>
        <div style={{ minWidth: "160px", textAlign: "left" }}>
          <div
            className="eyebrow"
            style={{ background: "none", padding: 0, margin: 0, fontSize: "0.6rem", opacity: 0.7 }}
          >
            {`Turn ${game.turn}`}
          </div>
          <div style={{ fontSize: "0.75rem", fontWeight: 700 }}>
            {game.lastRollTotal !== null ? `Last roll: ${game.lastRollTotal}` : "Roll to move"}
          </div>
          {game.extraTurn && game.phase === "await_end_turn" ? (
            <div style={{ fontSize: "0.7rem", color: "var(--forest-green)", fontWeight: 700 }}>
              Extra turn queued
            </div>
          ) : latestLogEntry ? (
            <div style={{ fontSize: "0.68rem", opacity: 0.7, lineHeight: 1.2 }}>
              {latestLogEntry}
            </div>
          ) : null}
        </div>
      </section>

      {/* Selected Space Section */}
      <section className="bottom-section info-section nm-flat">
        {selectedSpace ? (
          <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
            <div style={{ textAlign: "left" }}>
              <h4 style={{ margin: 0, fontSize: "0.9rem" }}>{selectedSpace.name}</h4>
              {selectedSpace.type === "property" && (
                <span
                  className="glass"
                  style={{
                    background: colorGroupColor[selectedSpace.colorGroup],
                    padding: "2px 8px",
                    borderRadius: "10px",
                    fontSize: "0.6rem",
                    color: "white",
                  }}
                >
                  {colorGroupLabel[selectedSpace.colorGroup]}
                </span>
              )}
            </div>
            <p style={{ fontSize: "0.75rem", lineHeight: "1.2", margin: 0, maxWidth: "200px" }}>
              {getPropertyDetailsSummary(game, selectedSpace.index)}
            </p>
          </div>
        ) : (
          <p className="muted-text" style={{ fontSize: "0.75rem", margin: 0 }}>
            Select a space for details.
          </p>
        )}
      </section>

      {/* Contextual Actions (Jail, Debt, Auction) */}
      {(currentPlayer.inJail || game.phase === "manage_debt" || game.phase === "auction") && (
        <section className="bottom-section situational-section glass nm-convex">
          {currentPlayer.inJail && game.phase === "await_roll" && (
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              <span style={{ fontSize: "0.8rem", fontWeight: 800 }}>JAIL:</span>
              {jailStatus ? (
                <span style={{ fontSize: "0.72rem", opacity: 0.75 }}>{jailStatus}</span>
              ) : null}
              <button
                className="btn-nm"
                style={{ padding: "0.4rem 0.8rem" }}
                onClick={payBail}
                disabled={currentPlayer.money < game.settings.bailAmount}
              >
                {`Pay $${game.settings.bailAmount}`}
              </button>
              <button
                className="btn-nm"
                style={{ padding: "0.4rem 0.8rem" }}
                onClick={playGetOutOfJailCard}
                disabled={currentPlayer.getOutOfJailCards.length === 0}
              >
                Use Card
              </button>
            </div>
          )}

          {game.phase === "manage_debt" && game.pendingDebt && (
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              <span style={{ fontSize: "0.8rem", fontWeight: 800, color: "var(--danger-red)" }}>
                DEBT: ${game.pendingDebt.amount}
              </span>
              <span style={{ fontSize: "0.72rem", opacity: 0.75, maxWidth: "220px" }}>
                {game.pendingDebt.reason}
              </span>
              <button
                className="btn-nm btn-primary"
                style={{ padding: "0.4rem 0.8rem" }}
                onClick={settleDebt}
                disabled={currentPlayer.money < game.pendingDebt.amount}
              >
                Pay
              </button>
              <button
                className="btn-nm btn-danger"
                style={{ padding: "0.4rem 0.8rem" }}
                onClick={declareBankruptcy}
              >
                Bankrupt
              </button>
            </div>
          )}

          {game.phase === "auction" && game.pendingAuction && activeBidder && (
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              <span style={{ fontSize: "0.8rem", fontWeight: 800 }}>
                {`AUCTION: ${auctionSpace?.name ?? "Property"} $${game.pendingAuction.highestBid}`}
              </span>
              <span style={{ fontSize: "0.72rem", opacity: 0.75 }}>
                {highestBidder ? `Leader: ${highestBidder.name}` : "No bids yet"}
              </span>
              {activeBidder.id === currentPlayer.id && (
                <>
                  <button
                    className="btn-nm"
                    style={{ padding: "0.4rem 0.8rem" }}
                    onClick={() => placeBid(game.pendingAuction!.highestBid + 10)}
                    disabled={currentPlayer.money < game.pendingAuction!.highestBid + 10}
                  >
                    +$10
                  </button>
                  <button
                    className="btn-nm"
                    style={{ padding: "0.4rem 0.8rem" }}
                    onClick={() => placeBid(game.pendingAuction!.highestBid + 50)}
                    disabled={currentPlayer.money < game.pendingAuction!.highestBid + 50}
                  >
                    +$50
                  </button>
                  <button
                    className="btn-nm"
                    style={{ padding: "0.4rem 0.8rem" }}
                    onClick={passAuction}
                  >
                    Pass
                  </button>
                </>
              )}
              {activeBidder.id !== currentPlayer.id && (
                <span style={{ fontSize: "0.72rem", opacity: 0.75 }}>
                  {`${activeBidder.name} is bidding`}
                </span>
              )}
            </div>
          )}
        </section>
      )}

      {/* Turn Log */}
      <section className="bottom-section log-section nm-inset">
        <div className="log-container">
          {reversedLog.map(({ entry, key }) => (
            <div key={key} className="log-entry">
              {entry}
            </div>
          ))}
        </div>
      </section>
    </footer>
  );
}
