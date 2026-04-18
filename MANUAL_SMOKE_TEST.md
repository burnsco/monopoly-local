# Manual Smoke Test

This is a practical click-through script for validating the current game in a browser.

## Setup

1. Run `npm run dev`.
2. Open the app in the browser.
3. Use a `2` player game for every scenario unless noted otherwise.
4. Use short names like `A` and `B` to speed up visual scanning.
5. Clear saved game data before each independent scenario.

## Global Checks

Run these once before the scenario-specific tests.

1. Start a new game.
2. Confirm the first player is highlighted in the left sidebar.
3. Confirm the bottom bar shows:
   - current turn number
   - current player
   - phase label
4. Click several spaces on the board.
5. Confirm the selected-space panel updates correctly.
6. Click the same space again.
7. Confirm selection clears.

## Scenario 1: Basic Turn Flow

Goal: verify roll, movement, landing, end turn, and active-player rotation.

1. Start a fresh `2` player game.
2. Click `Roll`.
3. Watch the token move step by step.
4. Confirm the selected board space follows the landing position.
5. If the player lands on a non-purchase, non-card, non-jail space:
   - confirm the phase changes to `Turn Over`
   - click `End`
6. Confirm:
   - turn number increments
   - active player changes
   - last roll clears
   - dice reset visually

Expected result:

1. Turn advances cleanly.
2. No modal gets stuck open.
3. No stale player remains highlighted after ending the turn.

## Scenario 2: Purchase Flow

Goal: verify unowned property purchase and cash reduction.

1. Start a fresh game.
2. Roll until the active player lands on an unowned property, railroad, or utility.
3. Confirm the purchase modal appears.
4. Confirm the modal shows:
   - property name
   - ownership summary
   - cost
   - remaining cash after purchase
5. Click `Buy`.

Expected result:

1. The modal closes.
2. Player cash decreases by the exact purchase amount.
3. The property appears in the current player's property manager.
4. The log records the purchase.
5. Phase changes to `Turn Over`.

## Scenario 3: Decline Purchase and Auction

Goal: verify auction entry, bidding, passing, and winner assignment.

1. Start a fresh game.
2. Roll until the active player lands on an unowned property.
3. In the purchase modal, click `Decline`.
4. Confirm the phase changes to auction.
5. Confirm the bottom bar shows:
   - auction property name
   - current highest bid
   - leader or `No bids yet`
6. As the active bidder, click `+$10`.
7. End the current bidder's participation by clicking `Pass` when that player becomes active again.
8. Let the other player either:
   - outbid and then pass later, or
   - pass immediately

Expected result:

1. Auction rotates between eligible players.
2. Passes are logged.
3. The winning player pays the final bid amount.
4. The deed transfers to the winner.
5. If everyone passes with no bids, nobody gets the property and the game returns to normal turn flow.

## Scenario 4: Doubles and Extra Turn

Goal: verify extra-turn behavior and confirm doubles do not carry across turns incorrectly.

1. Start a fresh game.
2. Keep rolling until a player rolls doubles.
3. Finish any resulting purchase/card/debt flow.
4. Reach `Turn Over`.
5. Confirm the UI indicates an extra turn is queued.
6. Click `End`.

Expected result:

1. The same player immediately gets the next roll.
2. The game does not skip to the other player.
3. The player does not get incorrectly sent to jail later because previous-turn doubles were retained.

## Scenario 5: Chance or Community Chest

Goal: verify card modal, card resolution, and return to correct phase.

1. Start a fresh game.
2. Roll until the player lands on `Chance` or `Community Chest`.
3. Confirm the card modal opens.
4. Read the card text and click `Resolve`.

Expected result:

1. Card effect applies correctly:
   - money changes if it is a money card
   - movement starts if it is a move card
   - jail triggers if it is a jail card
2. The card modal closes.
3. The game returns to the correct next state:
   - movement
   - debt management
   - turn over
4. The log reflects the resolution.

## Scenario 6: Jail Flow

Goal: verify jail options, bail, and get-out handling.

1. Start a fresh game.
2. Play until a player is sent to jail by:
   - landing on `Go To Jail`, or
   - drawing a jail card
3. Confirm the token moves to Jail.
4. When that player's next turn begins, confirm the bottom bar shows jail controls.
5. Confirm the jail status text shows the current attempt number.
6. If the player has enough money, click `Pay $50`.
7. On a separate run, keep the player in jail and attempt to roll out normally.
8. On another separate run, use a `Get Out of Jail Free` card if obtained.

Expected result:

1. Bail removes jail status and returns the player to normal roll flow.
2. Using a get-out card removes jail status and consumes the card.
3. Rolling doubles releases the player and starts movement.
4. Jail UI only appears when relevant.

## Scenario 7: Debt Management

Goal: verify debt phase, repayment, and debt reason clarity.

1. Start a fresh game.
2. Play until a player owes money they cannot immediately or trivially ignore:
   - tax landing
   - expensive rent
   - negative money card
3. Confirm the phase changes to debt management when cash is insufficient.
4. Confirm the bottom bar shows:
   - debt amount
   - debt reason
5. While in debt:
   - mortgage a property if available
   - or sell buildings if available
6. Once cash is sufficient, click `Pay`.

Expected result:

1. The debt phase blocks normal turn progression.
2. Mortgage/sell actions raise funds.
3. Clicking `Pay` settles the debt and returns to the correct next phase.
4. The log records the settlement.

## Scenario 8: Bankruptcy

Goal: verify bankruptcy transition, property transfer/reset, and game continuation.

1. Start a fresh game.
2. Play until one player owns at least one deed.
3. Force that player into a debt they cannot pay even after mortgaging or selling.
4. In debt phase, click `Bankrupt`.

Expected result:

1. The bankrupt player is marked as bankrupt in the player list.
2. Their money becomes `0`.
3. Their `Get Out of Jail Free` cards transfer to the creditor when there is one.
4. Their deeds transfer to the creditor when the debt is owed to another player.
5. If there is no player creditor, deeds return to unowned state.
6. The game advances to the next active player.

## Scenario 9: Win State

Goal: verify winner detection and end-of-game presentation.

1. Continue from the bankruptcy scenario until only one non-bankrupt player remains.
2. Confirm the game enters game-over state.

Expected result:

1. Winner modal appears.
2. Celebration effect renders.
3. Winner name is correct.
4. Clicking `New Game` clears the save and returns to setup.

## Scenario 10: Save and Resume

Goal: verify persistence around active gameplay.

1. Start a game and complete at least:
   - one purchase
   - one full turn change
2. Refresh the browser.
3. If returned to setup, click `Resume Game`.
4. Continue playing.
5. Click `Clear Save`.

Expected result:

1. Game resumes with the same players, money, deeds, and turn state.
2. Clearing the save returns to setup.
3. Refreshing after clearing the save should not restore the old game.

## Fast Regression Order

If you only want a short pass, run these in order:

1. Global Checks
2. Basic Turn Flow
3. Purchase Flow
4. Decline Purchase and Auction
5. Doubles and Extra Turn
6. Jail Flow
7. Debt Management
8. Bankruptcy
9. Win State
10. Save and Resume

## Notes While Testing

Pay attention to these specific failure signatures:

1. Token moves but phase does not advance.
2. Modal remains open after resolution.
3. Bottom bar shows stale auction/debt/jail information.
4. Wrong player is active after `End`.
5. Doubles grant too many turns or trigger jail incorrectly.
6. Property ownership changes visually but not in sidebar state.
7. Save resumes into a broken or blank game.
