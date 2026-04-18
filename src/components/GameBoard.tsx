import { motion, AnimatePresence } from "framer-motion";
import { BOARD_SPACES, colorGroupColor } from "../game/data/board";
import { getSpaceMoneyLabel } from "../game/selectors";
import { useGameStore } from "../game/store";
import { TokenIcon } from "./TokenIcon";

interface GridPosition {
  row: number;
  column: number;
}

function getBoardPosition(index: number): GridPosition {
  if (index <= 10) return { row: 11, column: 11 - index };
  if (index <= 19) return { row: 11 - (index - 10), column: 1 };
  if (index === 20) return { row: 1, column: 1 };
  if (index <= 29) return { row: 1, column: index - 19 };
  if (index === 30) return { row: 1, column: 11 };
  return { row: index - 29, column: 11 };
}

function getSideClass(index: number) {
  if (index === 0 || index === 10 || index === 20 || index === 30) return "side-corner";
  if (index > 0 && index < 10) return "side-bottom";
  if (index > 10 && index < 20) return "side-left";
  if (index > 20 && index < 30) return "side-top";
  return "side-right";
}

export function GameBoard() {
  const { game, setSelectedSpace } = useGameStore();
  if (!game) return null;

  return (
    <section className="board-shell">
      <div className="board-grid">
        {BOARD_SPACES.map((space) => {
          const tokensOnSpace = game.players.filter(
            (player) => !player.bankrupt && player.position === space.index,
          );
          const position = getBoardPosition(space.index);
          const side = getSideClass(space.index);

          return (
            <div
              key={space.index}
              className={`space-cell ${side} ${game.selectedSpace === space.index ? "selected" : ""}`}
              style={{ gridRow: position.row, gridColumn: position.column }}
              onClick={() =>
                setSelectedSpace(game.selectedSpace === space.index ? null : space.index)
              }
            >
              {space.type === "property" ? (
                <div
                  className="space-color-band"
                  style={{ background: colorGroupColor[space.colorGroup] }}
                />
              ) : null}

              <div className="space-content">
                <div className="space-name">{space.name}</div>
                <div className="space-meta">{getSpaceMoneyLabel(space.index)}</div>
              </div>

              <div className="token-stack">
                <AnimatePresence mode="popLayout">
                  {tokensOnSpace.map((player) => (
                    <motion.span
                      key={player.id}
                      layoutId={`player-token-${player.id}`}
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0, opacity: 0 }}
                      transition={{ type: "spring", stiffness: 200, damping: 20 }}
                      className="token-chip"
                      style={{ background: player.color }}
                    >
                      <TokenIcon name={player.token} size={10} strokeWidth={3} />
                    </motion.span>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          );
        })}

        <div className="board-center">
          <div className="center-bg-m">M</div>

          <div className="card-deck deck-chance">CHANCE</div>
          <div className="card-deck deck-chest">
            <span className="deck-chest-text">
              COMMUNITY
              <br />
              CHEST
            </span>
          </div>

          <h1 className="center-logo">MONOPOLY</h1>
        </div>
      </div>
    </section>
  );
}
