import { BOARD_SIZE, COLOR_GROUPS, RAILROAD_IDS, UTILITY_IDS, colorGroupLabel } from './data/board'
import { CARD_LOOKUP } from './data/cards'
import { randomDie, shuffle } from './random'
import { trimLog } from './setup'
import {
  getActivePlayers,
  getColorGroupLevels,
  getCurrentPlayer,
  getDeed,
  getOwnedPropertyIds,
  getPlayerById,
  getPropertyLevel,
  getRailroadCount,
  getSpace,
  getUtilityCount,
  ownsFullColorSet,
} from './selectors'
import type {
  AuctionState,
  BoardSpace,
  CardDefinition,
  ColorGroup,
  DeckState,
  DeckType,
  DiceTuple,
  GameState,
  MoveState,
  PendingContinuation,
  PlayerState,
} from './types'

function log(state: GameState, message: string): GameState {
  return {
    ...state,
    log: trimLog([...state.log, message]),
  }
}

function cloneState(state: GameState): GameState {
  return {
    ...state,
    players: state.players.map((player) => ({ ...player, getOutOfJailCards: [...player.getOutOfJailCards] })),
    deeds: Object.fromEntries(Object.entries(state.deeds).map(([key, deed]) => [Number(key), { ...deed }])),
    decks: {
      chance: {
        drawPile: [...state.decks.chance.drawPile],
        discardPile: [...state.decks.chance.discardPile],
      },
      communityChest: {
        drawPile: [...state.decks.communityChest.drawPile],
        discardPile: [...state.decks.communityChest.discardPile],
      },
    },
    move: state.move ? { ...state.move } : null,
    pendingPurchase: state.pendingPurchase ? { ...state.pendingPurchase } : null,
    pendingCard: state.pendingCard ? { ...state.pendingCard } : null,
    pendingAuction: state.pendingAuction
      ? {
          ...state.pendingAuction,
          eligiblePlayerIds: [...state.pendingAuction.eligiblePlayerIds],
          passedPlayerIds: [...state.pendingAuction.passedPlayerIds],
        }
      : null,
    pendingDebt: state.pendingDebt ? { ...state.pendingDebt } : null,
    continuation: state.continuation
      ? {
          ...state.continuation,
          ...(state.continuation.type === 'movement'
            ? { move: { ...state.continuation.move } }
            : { transfers: [...state.continuation.transfers] }),
        }
      : null,
  }
}

function setPlayer(state: GameState, playerId: string, updater: (player: PlayerState) => PlayerState): GameState {
  return {
    ...state,
    players: state.players.map((player) => (player.id === playerId ? updater(player) : player)),
  }
}

function getNextActivePlayerIndex(state: GameState, startIndex: number): number {
  for (let offset = 1; offset <= state.players.length; offset += 1) {
    const candidateIndex = (startIndex + offset) % state.players.length
    if (!state.players[candidateIndex].bankrupt) {
      return candidateIndex
    }
  }

  return startIndex
}

function payPlayer(state: GameState, playerId: string, amount: number): GameState {
  return setPlayer(state, playerId, (player) => ({ ...player, money: player.money + amount }))
}

function createMovement(
  playerId: string,
  total: number,
  dice: DiceTuple | null,
  options?: Partial<Pick<MoveState, 'direction' | 'startedWithDoubles' | 'suppressExtraTurn' | 'passGoAllowed' | 'specialRent'>>,
): MoveState {
  return {
    playerId,
    stepsRemaining: Math.abs(total),
    direction: options?.direction ?? 1,
    dice,
    total,
    startedWithDoubles: options?.startedWithDoubles ?? false,
    suppressExtraTurn: options?.suppressExtraTurn ?? false,
    passGoAllowed: options?.passGoAllowed ?? true,
    specialRent: options?.specialRent,
  }
}

function countBuildingsOwnedByPlayer(state: GameState, playerId: string): { houses: number; hotels: number } {
  return getOwnedPropertyIds(state, playerId).reduce(
    (accumulator, propertyId) => {
      const deed = state.deeds[propertyId]
      accumulator.houses += deed.hotel ? 0 : deed.houses
      accumulator.hotels += deed.hotel ? 1 : 0
      return accumulator
    },
    { houses: 0, hotels: 0 },
  )
}

function startDebt(
  originalState: GameState,
  amount: number,
  reason: string,
  recipientId: string | null,
  continuation: PendingContinuation = null,
): GameState {
  const state = cloneState(originalState)
  const payer = getCurrentPlayer(state)

  if (payer.money >= amount) {
    let paid = payPlayer(state, payer.id, -amount)
    if (recipientId) {
      paid = payPlayer(paid, recipientId, amount)
    }
    paid = log(paid, `${payer.name} paid $${amount} for ${reason}.`)
    return applyContinuation({
      ...paid,
      pendingDebt: null,
      continuation: null,
    }, continuation)
  }

  return log(
    {
      ...state,
      phase: 'manage_debt',
      pendingDebt: {
        payerId: payer.id,
        amount,
        recipientId,
        reason,
      },
      continuation,
      pendingPurchase: null,
      pendingAuction: null,
    },
    `${payer.name} needs $${amount} for ${reason} and must raise funds.`,
  )
}

function settlePendingDebt(originalState: GameState): GameState {
  const state = cloneState(originalState)
  const debt = state.pendingDebt

  if (!debt) {
    return state
  }

  const payer = getPlayerById(state, debt.payerId)

  if (!payer || payer.money < debt.amount) {
    return state
  }

  let nextState = payPlayer(state, debt.payerId, -debt.amount)
  if (debt.recipientId) {
    nextState = payPlayer(nextState, debt.recipientId, debt.amount)
  }

  nextState = log(nextState, `${payer.name} settled $${debt.amount} for ${debt.reason}.`)
  const continuation = nextState.continuation

  nextState = {
    ...nextState,
    pendingDebt: null,
    continuation: null,
  }

  return applyContinuation(nextState, continuation)
}

function applyContinuation(state: GameState, continuation: PendingContinuation): GameState {
  if (!continuation) {
    return finishResolution(state)
  }

  if (continuation.type === 'movement') {
    return {
      ...state,
      phase: 'moving',
      move: continuation.move,
    }
  }

  if (continuation.type === 'transfers') {
    const transferredState = continuation.transfers.reduce(
      (currentState, transfer) => payPlayer(currentState, transfer.playerId, transfer.amount),
      state,
    )

    return finishResolution(transferredState)
  }

  return state
}

function finishResolution(state: GameState): GameState {
  if (state.winnerId) {
    return {
      ...state,
      phase: 'game_over',
    }
  }

  return {
    ...state,
    phase: 'await_end_turn',
    pendingPurchase: null,
    pendingAuction: null,
    pendingCard: null,
    pendingDebt: null,
    continuation: null,
  }
}

function drawFromDeck(deck: DeckState): { cardId: string; deck: DeckState } {
  let drawPile = [...deck.drawPile]
  let discardPile = [...deck.discardPile]

  if (drawPile.length === 0) {
    drawPile = shuffle(discardPile)
    discardPile = []
  }

  const [cardId, ...rest] = drawPile
  return {
    cardId,
    deck: {
      drawPile: rest,
      discardPile,
    },
  }
}

function discardCard(state: GameState, deckType: DeckType, cardId: string): GameState {
  return {
    ...state,
    decks: {
      ...state.decks,
      [deckType]: {
        ...state.decks[deckType],
        discardPile: [...state.decks[deckType].discardPile, cardId],
      },
    },
  }
}

function checkWinner(state: GameState): GameState {
  const activePlayers = getActivePlayers(state)

  if (activePlayers.length === 1) {
    const winner = activePlayers[0]
    return log(
      {
        ...state,
        winnerId: winner.id,
        phase: 'game_over',
      },
      `${winner.name} wins the game.`,
    )
  }

  return state
}

function sendPlayerToJail(originalState: GameState, playerId: string, reason: string): GameState {
  let state = setPlayer(originalState, playerId, (player) => ({
    ...player,
    inJail: true,
    jailTurns: 0,
    position: 10,
  }))

  const player = getPlayerById(state, playerId)
  state = {
    ...state,
    dice: null,
    lastRollTotal: null,
    doublesRolledThisTurn: 0,
    move: null,
    extraTurn: false,
    pendingPurchase: null,
    pendingAuction: null,
    pendingCard: null,
    pendingDebt: null,
    continuation: null,
    selectedSpace: 10,
  }

  return log(state, `${player?.name ?? 'A player'} was sent to Jail: ${reason}.`)
}

function resolveDirectLanding(
  state: GameState,
  landingSpace: BoardSpace,
  move: MoveState | null,
): GameState {
  const currentPlayer = getCurrentPlayer(state)

  if (landingSpace.type === 'go' || landingSpace.type === 'jail' || landingSpace.type === 'freeParking') {
    return finishResolution(state)
  }

  if (landingSpace.type === 'tax') {
    return startDebt(state, landingSpace.amount, landingSpace.name, null)
  }

  if (landingSpace.type === 'goToJail') {
    return finishResolution(sendPlayerToJail(state, currentPlayer.id, 'Landed on Go To Jail'))
  }

  if (landingSpace.type === 'chance' || landingSpace.type === 'communityChest') {
    const deckType = landingSpace.type
    const draw = drawFromDeck(state.decks[deckType])
    const card = CARD_LOOKUP[draw.cardId]

    return {
      ...state,
      phase: 'show_card',
      decks: {
        ...state.decks,
        [deckType]: draw.deck,
      },
      pendingCard: {
        deck: deckType,
        cardId: card.id,
        description: card.description,
      },
      move,
    }
  }

  const deed = getDeed(state, landingSpace.index)

  if (!deed.ownerId) {
    return {
      ...state,
      phase: 'await_purchase',
      pendingPurchase: { propertyId: landingSpace.index },
    }
  }

  if (deed.ownerId === currentPlayer.id || deed.mortgaged) {
    return finishResolution(state)
  }

  const owner = getPlayerById(state, deed.ownerId)
  let rent = 0

  if (landingSpace.type === 'property') {
    if (deed.hotel) {
      rent = landingSpace.rent[5]
    } else if (deed.houses > 0) {
      rent = landingSpace.rent[deed.houses]
    } else {
      rent = landingSpace.rent[0]
      if (ownsFullColorSet(state, deed.ownerId, landingSpace.colorGroup)) {
        rent *= 2
      }
    }
  }

  if (landingSpace.type === 'railroad') {
    rent = 25 * 2 ** (getRailroadCount(state, deed.ownerId) - 1)
    if (move?.specialRent?.railroadMultiplier) {
      rent *= move.specialRent.railroadMultiplier
    }
  }

  if (landingSpace.type === 'utility') {
    const rollTotal = move?.dice ? move.dice[0] + move.dice[1] : state.lastRollTotal ?? 0
    if (move?.specialRent?.utilityMultiplier) {
      rent = rollTotal * move.specialRent.utilityMultiplier
    } else {
      const utilitiesOwned = getUtilityCount(state, deed.ownerId)
      rent = rollTotal * (utilitiesOwned >= 2 ? 10 : 4)
    }
  }

  return startDebt(state, rent, `rent for ${landingSpace.name} to ${owner?.name ?? 'the owner'}`, deed.ownerId)
}

function nearestFrom(position: number, options: readonly number[]): number {
  for (let offset = 1; offset <= BOARD_SIZE; offset += 1) {
    const candidate = (position + offset) % BOARD_SIZE
    if (options.includes(candidate)) {
      return candidate
    }
  }

  return options[0]
}

function processCardEffect(originalState: GameState, card: CardDefinition): GameState {
  const state = cloneState(originalState)
  const player = getCurrentPlayer(state)
  let nextState: GameState = {
    ...state,
    pendingCard: null,
  }

  if (card.action.type === 'getOutOfJailFree') {
    nextState = setPlayer(nextState, player.id, (current) => ({
      ...current,
      getOutOfJailCards: [...current.getOutOfJailCards, card.deck],
    }))
    nextState = log(nextState, `${player.name} keeps a Get Out of Jail Free card.`)
    return finishResolution(nextState)
  }

  nextState = discardCard(nextState, card.deck, card.id)

  switch (card.action.type) {
    case 'money': {
      if (card.action.amount >= 0) {
        nextState = payPlayer(nextState, player.id, card.action.amount)
        return finishResolution(log(nextState, `${player.name} collected $${card.action.amount}.`))
      }

      return startDebt(nextState, Math.abs(card.action.amount), `card: ${card.description}`, null)
    }
    case 'moveTo': {
      const destination = card.action.destination
      const currentPosition = player.position
      const steps = destination >= currentPosition ? destination - currentPosition : BOARD_SIZE - currentPosition + destination

      if (steps === 0) {
        return resolveDirectLanding(nextState, getSpace(destination), null)
      }

      return {
        ...nextState,
        phase: 'moving',
        move: createMovement(player.id, steps, null, {
          passGoAllowed: card.action.collectGo,
          startedWithDoubles: false,
          suppressExtraTurn: true,
        }),
      }
    }
    case 'moveRelative': {
      return {
        ...nextState,
        phase: 'moving',
        move: createMovement(player.id, card.action.spaces, null, {
          direction: card.action.spaces >= 0 ? 1 : -1,
          passGoAllowed: false,
          startedWithDoubles: false,
          suppressExtraTurn: true,
        }),
      }
    }
    case 'goToJail':
      return finishResolution(sendPlayerToJail(nextState, player.id, `Card: ${card.description}`))
    case 'collectFromEach': {
      const others = state.players.filter((candidate) => candidate.id !== player.id && !candidate.bankrupt)
      let totalCollected = 0

      for (const other of others) {
        if (other.money >= card.action.amount) {
          nextState = payPlayer(nextState, other.id, -card.action.amount)
          totalCollected += card.action.amount
        } else {
          nextState = payPlayer(nextState, other.id, -other.money)
          totalCollected += other.money
        }
      }

      nextState = payPlayer(nextState, player.id, totalCollected)
      return finishResolution(log(nextState, `${player.name} collected $${totalCollected} from the other players.`))
    }
    case 'payEach': {
      const activeOthers = state.players.filter((candidate) => candidate.id !== player.id && !candidate.bankrupt)
      const amountPerPlayer = card.action.amount
      const total = activeOthers.length * amountPerPlayer

      return startDebt(nextState, total, `card: ${card.description}`, null, {
        type: 'transfers',
        transfers: activeOthers.map((other) => ({
          playerId: other.id,
          amount: amountPerPlayer,
        })),
      })
    }
    case 'streetRepairs': {
      const buildings = countBuildingsOwnedByPlayer(nextState, player.id)
      const total = buildings.houses * card.action.perHouse + buildings.hotels * card.action.perHotel

      if (total === 0) {
        return finishResolution(log(nextState, `${player.name} has no buildings to repair.`))
      }

      return startDebt(nextState, total, `card: ${card.description}`, null)
    }
    case 'nearestRailroad': {
      const target = nearestFrom(player.position, RAILROAD_IDS)
      const steps = target >= player.position ? target - player.position : BOARD_SIZE - player.position + target

      return {
        ...nextState,
        phase: 'moving',
        move: createMovement(player.id, steps, state.dice, {
          passGoAllowed: true,
          suppressExtraTurn: true,
          specialRent: {
            railroadMultiplier: card.action.multiplier,
          },
        }),
      }
    }
    case 'nearestUtility': {
      const target = nearestFrom(player.position, UTILITY_IDS)
      const steps = target >= player.position ? target - player.position : BOARD_SIZE - player.position + target

      return {
        ...nextState,
        phase: 'moving',
        move: createMovement(player.id, steps, state.dice, {
          passGoAllowed: true,
          suppressExtraTurn: true,
          specialRent: {
            utilityMultiplier: card.action.multiplier,
          },
        }),
      }
    }
    default:
      return nextState
  }
}

export function rollDiceForCurrentPlayer(state: GameState): GameState {
  return applyRoll(state, [randomDie(), randomDie()])
}

export function applyRoll(originalState: GameState, dice: DiceTuple): GameState {
  const state = cloneState(originalState)

  if (state.phase !== 'await_roll') {
    return state
  }

  const currentPlayer = getCurrentPlayer(state)

  if (currentPlayer.bankrupt) {
    return state
  }

  if (currentPlayer.inJail) {
    return applyJailRoll(state, dice)
  }

  const isDouble = dice[0] === dice[1]
  const nextDoubles = isDouble ? state.doublesRolledThisTurn + 1 : 0

  if (isDouble && nextDoubles >= 3) {
    return finishResolution(sendPlayerToJail(state, currentPlayer.id, 'Rolled doubles three times in a row'))
  }

  return log(
    {
      ...state,
      phase: 'moving',
      dice,
      lastRollTotal: dice[0] + dice[1],
      doublesRolledThisTurn: nextDoubles,
      move: createMovement(currentPlayer.id, dice[0] + dice[1], dice, {
        startedWithDoubles: isDouble,
      }),
      extraTurn: false,
    },
    `${currentPlayer.name} rolled ${dice[0]} + ${dice[1]}.`,
  )
}

function applyJailRoll(originalState: GameState, dice: DiceTuple): GameState {
  let state = cloneState(originalState)
  const player = getCurrentPlayer(state)
  const isDouble = dice[0] === dice[1]

  state = {
    ...state,
    dice,
    lastRollTotal: dice[0] + dice[1],
    doublesRolledThisTurn: 0,
  }

  if (isDouble) {
    state = setPlayer(state, player.id, (current) => ({
      ...current,
      inJail: false,
      jailTurns: 0,
    }))

    return log(
      {
        ...state,
        phase: 'moving',
        move: createMovement(player.id, dice[0] + dice[1], dice, {
          startedWithDoubles: false,
          suppressExtraTurn: true,
        }),
      },
      `${player.name} rolled doubles to leave Jail.`,
    )
  }

  if (player.jailTurns >= 2) {
    state = setPlayer(state, player.id, (current) => ({
      ...current,
      inJail: false,
      jailTurns: 0,
    }))

    return startDebt(
      {
        ...state,
        continuation: {
          type: 'movement',
          move: createMovement(player.id, dice[0] + dice[1], dice, {
            suppressExtraTurn: true,
          }),
        },
      },
      state.settings.bailAmount,
      'mandatory bail after three turns in Jail',
      null,
      {
        type: 'movement',
        move: createMovement(player.id, dice[0] + dice[1], dice, {
          suppressExtraTurn: true,
        }),
      },
    )
  }

  state = setPlayer(state, player.id, (current) => ({
    ...current,
    jailTurns: current.jailTurns + 1,
  }))

  return log(finishResolution(state), `${player.name} did not roll doubles and remains in Jail.`)
}

export function payBail(state: GameState): GameState {
  const currentPlayer = getCurrentPlayer(state)

  if (state.phase !== 'await_roll' || !currentPlayer.inJail || currentPlayer.money < state.settings.bailAmount) {
    return state
  }

  let nextState = payPlayer(state, currentPlayer.id, -state.settings.bailAmount)
  nextState = setPlayer(nextState, currentPlayer.id, (player) => ({
    ...player,
    inJail: false,
    jailTurns: 0,
  }))

  return log(nextState, `${currentPlayer.name} paid $${state.settings.bailAmount} bail.`)
}

export function playGetOutOfJailCard(state: GameState): GameState {
  const currentPlayer = getCurrentPlayer(state)
  const cardDeck = currentPlayer.getOutOfJailCards[0]

  if (state.phase !== 'await_roll' || !currentPlayer.inJail || !cardDeck) {
    return state
  }

  let nextState = setPlayer(state, currentPlayer.id, (player) => ({
    ...player,
    inJail: false,
    jailTurns: 0,
    getOutOfJailCards: player.getOutOfJailCards.slice(1),
  }))

  nextState = discardCard(nextState, cardDeck, `${cardDeck === 'chance' ? 'chance' : 'chest'}-get-out`)

  return log(nextState, `${currentPlayer.name} used a Get Out of Jail Free card.`)
}

export function advanceMovementOneStep(originalState: GameState): GameState {
  const state = cloneState(originalState)
  const move = state.move

  if (!move) {
    return state
  }

  const player = getPlayerById(state, move.playerId)

  if (!player) {
    return state
  }

  const nextPosition = (player.position + move.direction + BOARD_SIZE) % BOARD_SIZE
  let nextState = setPlayer(state, player.id, (current) => ({
    ...current,
    position: nextPosition,
  }))

  if (move.direction === 1 && move.passGoAllowed && nextPosition === 0) {
    nextState = payPlayer(nextState, player.id, nextState.settings.passGoAmount)
    nextState = log(nextState, `${player.name} passed Go and collected $${nextState.settings.passGoAmount}.`)
  }

  const remaining = move.stepsRemaining - 1
  nextState = {
    ...nextState,
    selectedSpace: nextPosition,
    move: {
      ...move,
      stepsRemaining: remaining,
    },
  }

  if (remaining > 0) {
    return nextState
  }

  return resolveLanding({
    ...nextState,
    move: null,
  }, {
    ...move,
    stepsRemaining: 0,
  })
}

function resolveLanding(state: GameState, completedMove: MoveState): GameState {
  const player = getCurrentPlayer(state)
  const space = getSpace(player.position)
  const resolved = resolveDirectLanding(
    {
      ...state,
      extraTurn: completedMove.startedWithDoubles && !completedMove.suppressExtraTurn,
    },
    space,
    completedMove,
  )

  if (resolved.phase === 'await_end_turn') {
    const refreshedPlayer = getCurrentPlayer(resolved)
    return {
      ...resolved,
      extraTurn: resolved.extraTurn && !refreshedPlayer.inJail,
    }
  }

  return resolved
}

function startAuction(originalState: GameState, propertyId: number): GameState {
  const state = cloneState(originalState)
  const eligiblePlayerIds = state.players.filter((player) => !player.bankrupt).map((player) => player.id)

  if (eligiblePlayerIds.length < 2) {
    return finishResolution(log(state, `No auction was started for ${getSpace(propertyId).name}.`))
  }

  const auction: AuctionState = {
    propertyId,
    activePlayerId: eligiblePlayerIds[0],
    eligiblePlayerIds,
    passedPlayerIds: [],
    highestBidderId: null,
    highestBid: 0,
  }

  return log(
    {
      ...state,
      phase: 'auction',
      pendingPurchase: null,
      pendingAuction: auction,
    },
    `Auction started for ${getSpace(propertyId).name}.`,
  )
}

export function buyPendingProperty(state: GameState): GameState {
  const purchase = state.pendingPurchase

  if (state.phase !== 'await_purchase' || !purchase) {
    return state
  }

  const player = getCurrentPlayer(state)
  const property = getSpace(purchase.propertyId)

  if (!('price' in property) || player.money < property.price) {
    return state
  }

  let nextState = payPlayer(state, player.id, -property.price)
  nextState = {
    ...nextState,
    deeds: {
      ...nextState.deeds,
      [purchase.propertyId]: {
        ...nextState.deeds[purchase.propertyId],
        ownerId: player.id,
      },
    },
  }

  return finishResolution(log(nextState, `${player.name} bought ${property.name} for $${property.price}.`))
}

export function declinePendingProperty(state: GameState): GameState {
  const purchase = state.pendingPurchase

  if (state.phase !== 'await_purchase' || !purchase) {
    return state
  }

  if (!state.settings.auctionsEnabled) {
    return finishResolution(log({ ...state, pendingPurchase: null }, `${getCurrentPlayer(state).name} declined to buy ${getSpace(purchase.propertyId).name}.`))
  }

  return startAuction(log({ ...state, pendingPurchase: null }, `${getCurrentPlayer(state).name} declined to buy ${getSpace(purchase.propertyId).name}.`), purchase.propertyId)
}

export function placeAuctionBid(state: GameState, amount: number): GameState {
  const auction = state.pendingAuction

  if (state.phase !== 'auction' || !auction) {
    return state
  }

  const bidder = getPlayerById(state, auction.activePlayerId)

  if (!bidder || bidder.money < amount || amount <= auction.highestBid) {
    return state
  }

  const updatedAuction: AuctionState = {
    ...auction,
    highestBid: amount,
    highestBidderId: bidder.id,
  }

  return log(
    {
      ...state,
      pendingAuction: advanceAuctionTurn({ ...updatedAuction }),
    },
    `${bidder.name} bid $${amount}.`,
  )
}

function advanceAuctionTurn(auction: AuctionState): AuctionState | null {
  const stillActive = auction.eligiblePlayerIds.filter((playerId) => !auction.passedPlayerIds.includes(playerId))

  if (stillActive.length === 0) {
    return null
  }

  if (stillActive.length === 1 && auction.highestBidderId) {
    return {
      ...auction,
      activePlayerId: stillActive[0],
    }
  }

  const activeIndex = stillActive.indexOf(auction.activePlayerId)
  const nextPlayer = stillActive[(activeIndex + 1 + stillActive.length) % stillActive.length]

  return {
    ...auction,
    activePlayerId: nextPlayer,
  }
}

export function passAuctionTurn(state: GameState): GameState {
  const auction = state.pendingAuction

  if (state.phase !== 'auction' || !auction) {
    return state
  }

  const updatedAuction: AuctionState = {
    ...auction,
    passedPlayerIds: auction.passedPlayerIds.includes(auction.activePlayerId)
      ? auction.passedPlayerIds
      : [...auction.passedPlayerIds, auction.activePlayerId],
  }

  const bidder = getPlayerById(state, auction.activePlayerId)
  const remainingPlayers = updatedAuction.eligiblePlayerIds.filter((playerId) => !updatedAuction.passedPlayerIds.includes(playerId))

  if (remainingPlayers.length === 0 && !updatedAuction.highestBidderId) {
    return finishResolution(log({ ...state, pendingAuction: null }, `No one bought ${getSpace(auction.propertyId).name} at auction.`))
  }

  if (remainingPlayers.length === 0 && updatedAuction.highestBidderId) {
    const winningPlayer = getPlayerById(state, updatedAuction.highestBidderId)
    const property = getSpace(updatedAuction.propertyId)

    if (!winningPlayer || !('price' in property) || winningPlayer.money < updatedAuction.highestBid) {
      return finishResolution(log({ ...state, pendingAuction: null }, `Auction for ${property.name} ended without a valid buyer.`))
    }

    let nextState = payPlayer(state, winningPlayer.id, -updatedAuction.highestBid)
    nextState = {
      ...nextState,
      pendingAuction: null,
      deeds: {
        ...nextState.deeds,
        [updatedAuction.propertyId]: {
          ...nextState.deeds[updatedAuction.propertyId],
          ownerId: winningPlayer.id,
        },
      },
    }

    return finishResolution(log(nextState, `${winningPlayer.name} won the auction for ${property.name} at $${updatedAuction.highestBid}.`))
  }

  if (remainingPlayers.length === 1 && updatedAuction.highestBidderId && remainingPlayers[0] === updatedAuction.highestBidderId) {
    const winningPlayer = getPlayerById(state, updatedAuction.highestBidderId)
    const property = getSpace(updatedAuction.propertyId)

    if (!winningPlayer || !('price' in property) || winningPlayer.money < updatedAuction.highestBid) {
      return finishResolution(log({ ...state, pendingAuction: null }, `Auction for ${property.name} ended without a valid buyer.`))
    }

    let nextState = payPlayer(state, winningPlayer.id, -updatedAuction.highestBid)
    nextState = {
      ...nextState,
      pendingAuction: null,
      deeds: {
        ...nextState.deeds,
        [updatedAuction.propertyId]: {
          ...nextState.deeds[updatedAuction.propertyId],
          ownerId: winningPlayer.id,
        },
      },
    }

    return finishResolution(log(nextState, `${winningPlayer.name} won the auction for ${property.name} at $${updatedAuction.highestBid}.`))
  }

  return log(
    {
      ...state,
      pendingAuction: advanceAuctionTurn(updatedAuction),
    },
    `${bidder?.name ?? 'A player'} passed.`,
  )
}

export function acknowledgeCard(state: GameState): GameState {
  const pendingCard = state.pendingCard

  if (state.phase !== 'show_card' || !pendingCard) {
    return state
  }

  const card = CARD_LOOKUP[pendingCard.cardId]
  return processCardEffect(state, card)
}

function canMortgageProperty(state: GameState, propertyId: number, playerId: string): boolean {
  const deed = getDeed(state, propertyId)
  const space = getSpace(propertyId)

  if (!deed || deed.ownerId !== playerId || deed.mortgaged) {
    return false
  }

  if (space.type === 'property') {
    const groupIds = COLOR_GROUPS[space.colorGroup]
    return groupIds.every((groupPropertyId) => {
      const groupDeed = getDeed(state, groupPropertyId)
      return !groupDeed.hotel && groupDeed.houses === 0
    })
  }

  return true
}

function canUnmortgageProperty(state: GameState, propertyId: number, playerId: string): boolean {
  const deed = getDeed(state, propertyId)
  if (!deed || deed.ownerId !== playerId || !deed.mortgaged) {
    return false
  }

  const space = getSpace(propertyId)
  const cost = Math.ceil(('mortgageValue' in space ? space.mortgageValue : 0) * 1.1)

  return (getPlayerById(state, playerId)?.money ?? 0) >= cost
}

function canBuildOnProperty(state: GameState, propertyId: number, playerId: string): boolean {
  if (!(state.phase === 'await_roll' || state.phase === 'await_end_turn')) {
    return false
  }

  const space = getSpace(propertyId)
  const deed = getDeed(state, propertyId)

  if (space.type !== 'property' || deed.ownerId !== playerId || deed.mortgaged || deed.hotel) {
    return false
  }

  if (!ownsFullColorSet(state, playerId, space.colorGroup)) {
    return false
  }

  const player = getPlayerById(state, playerId)
  if (!player || player.money < space.houseCost) {
    return false
  }

  const levels = getColorGroupLevels(state, space.colorGroup)
  const currentLevel = getPropertyLevel(deed)
  return currentLevel === Math.min(...levels) && currentLevel < 5
}

function canSellBuilding(state: GameState, propertyId: number, playerId: string): boolean {
  const space = getSpace(propertyId)
  const deed = getDeed(state, propertyId)

  if (space.type !== 'property' || deed.ownerId !== playerId) {
    return false
  }

  const levels = getColorGroupLevels(state, space.colorGroup)
  const currentLevel = getPropertyLevel(deed)
  return currentLevel > 0 && currentLevel === Math.max(...levels)
}

export function buildHouseOrHotel(state: GameState, propertyId: number): GameState {
  const player = getCurrentPlayer(state)

  if (!canBuildOnProperty(state, propertyId, player.id)) {
    return state
  }

  const space = getSpace(propertyId)
  if (space.type !== 'property') {
    return state
  }

  let nextState = payPlayer(state, player.id, -space.houseCost)
  const deed = getDeed(nextState, propertyId)
  const currentLevel = getPropertyLevel(deed)
  const nextLevel = currentLevel + 1

  nextState = {
    ...nextState,
    deeds: {
      ...nextState.deeds,
      [propertyId]: {
        ...deed,
        houses: nextLevel >= 5 ? 4 : nextLevel,
        hotel: nextLevel >= 5,
      },
    },
  }

  return log(
    nextState,
    `${player.name} built ${nextLevel >= 5 ? 'a hotel' : 'a house'} on ${space.name}.`,
  )
}

export function sellBuilding(state: GameState, propertyId: number): GameState {
  const player = getCurrentPlayer(state)

  if (!canSellBuilding(state, propertyId, player.id)) {
    return state
  }

  const space = getSpace(propertyId)
  if (space.type !== 'property') {
    return state
  }

  const deed = getDeed(state, propertyId)
  const currentLevel = getPropertyLevel(deed)
  const nextLevel = currentLevel - 1
  let nextState = payPlayer(state, player.id, Math.floor(space.houseCost / 2))

  nextState = {
    ...nextState,
    deeds: {
      ...nextState.deeds,
      [propertyId]: {
        ...deed,
        houses: nextLevel >= 5 ? 4 : Math.max(0, nextLevel),
        hotel: nextLevel >= 5,
      },
    },
  }

  return log(nextState, `${player.name} sold a building on ${space.name} for $${Math.floor(space.houseCost / 2)}.`)
}

export function mortgageProperty(state: GameState, propertyId: number): GameState {
  const player = getCurrentPlayer(state)

  if (!(state.phase === 'await_roll' || state.phase === 'await_end_turn' || state.phase === 'manage_debt') || !canMortgageProperty(state, propertyId, player.id)) {
    return state
  }

  const space = getSpace(propertyId)
  if (!('mortgageValue' in space)) {
    return state
  }

  let nextState = payPlayer(state, player.id, space.mortgageValue)
  nextState = {
    ...nextState,
    deeds: {
      ...nextState.deeds,
      [propertyId]: {
        ...nextState.deeds[propertyId],
        mortgaged: true,
      },
    },
  }

  return log(nextState, `${player.name} mortgaged ${space.name} for $${space.mortgageValue}.`)
}

export function unmortgageProperty(state: GameState, propertyId: number): GameState {
  const player = getCurrentPlayer(state)

  if (!(state.phase === 'await_roll' || state.phase === 'await_end_turn') || !canUnmortgageProperty(state, propertyId, player.id)) {
    return state
  }

  const space = getSpace(propertyId)
  if (!('mortgageValue' in space)) {
    return state
  }

  const cost = Math.ceil(space.mortgageValue * 1.1)
  let nextState = payPlayer(state, player.id, -cost)
  nextState = {
    ...nextState,
    deeds: {
      ...nextState.deeds,
      [propertyId]: {
        ...nextState.deeds[propertyId],
        mortgaged: false,
      },
    },
  }

  return log(nextState, `${player.name} unmortgaged ${space.name} for $${cost}.`)
}

export function settleDebtIfPossible(state: GameState): GameState {
  if (state.phase !== 'manage_debt') {
    return state
  }

  return settlePendingDebt(state)
}

export function declareBankruptcy(originalState: GameState): GameState {
  const state = cloneState(originalState)
  const debt = state.pendingDebt
  const player = getCurrentPlayer(state)

  if (state.phase !== 'manage_debt' || !debt || debt.payerId !== player.id) {
    return state
  }

  let nextState = state
  const transferToPlayer = debt.recipientId ? getPlayerById(state, debt.recipientId) : null

  for (const propertyId of getOwnedPropertyIds(state, player.id)) {
    const space = getSpace(propertyId)
    const deed = getDeed(nextState, propertyId)

    if (space.type === 'property') {
      nextState = {
        ...nextState,
        deeds: {
          ...nextState.deeds,
          [propertyId]: {
            ...deed,
            houses: 0,
            hotel: false,
            ownerId: transferToPlayer ? transferToPlayer.id : null,
            mortgaged: transferToPlayer ? deed.mortgaged : false,
          },
        },
      }
    } else {
      nextState = {
        ...nextState,
        deeds: {
          ...nextState.deeds,
          [propertyId]: {
            ...deed,
            ownerId: transferToPlayer ? transferToPlayer.id : null,
            mortgaged: transferToPlayer ? deed.mortgaged : false,
          },
        },
      }
    }
  }

  if (transferToPlayer && player.money > 0) {
    nextState = payPlayer(nextState, transferToPlayer.id, player.money)
  }

  const cardsToTransfer = [...player.getOutOfJailCards]

  nextState = setPlayer(nextState, player.id, (current) => ({
    ...current,
    money: 0,
    bankrupt: true,
    getOutOfJailCards: [],
  }))

  if (transferToPlayer && cardsToTransfer.length > 0) {
    nextState = setPlayer(nextState, transferToPlayer.id, (current) => ({
      ...current,
      getOutOfJailCards: [...current.getOutOfJailCards, ...cardsToTransfer],
    }))
  }

  nextState = log(nextState, `${player.name} went bankrupt.`)
  nextState = {
    ...nextState,
    pendingDebt: null,
    continuation: null,
    pendingPurchase: null,
    pendingAuction: null,
    pendingCard: null,
    move: null,
    dice: null,
    lastRollTotal: null,
    extraTurn: false,
  }

  nextState = checkWinner(nextState)

  if (nextState.winnerId) {
    return nextState
  }

  const nextIndex = getNextActivePlayerIndex(nextState, state.currentPlayerIndex)

  return {
    ...nextState,
    currentPlayerIndex: nextIndex,
    phase: 'await_roll',
    doublesRolledThisTurn: 0,
    turn: nextState.turn + 1,
  }
}

export function endTurn(state: GameState): GameState {
  if (state.phase !== 'await_end_turn') {
    return state
  }

  const currentPlayer = getCurrentPlayer(state)

  if (state.extraTurn) {
    return {
      ...log(state, `${currentPlayer.name} gets another turn for rolling doubles.`),
      phase: 'await_roll',
      extraTurn: false,
      dice: null,
      lastRollTotal: null,
    }
  }

  const nextPlayerIndex = getNextActivePlayerIndex(state, state.currentPlayerIndex)
  const nextPlayer = state.players[nextPlayerIndex]

  return {
    ...log(state, `${currentPlayer.name} ended their turn. ${nextPlayer.name} is up.`),
    currentPlayerIndex: nextPlayerIndex,
    phase: 'await_roll',
    dice: null,
    lastRollTotal: null,
    doublesRolledThisTurn: 0,
    extraTurn: false,
    turn: state.turn + 1,
  }
}

export function selectSpace(state: GameState, spaceIndex: number | null): GameState {
  return {
    ...state,
    selectedSpace: spaceIndex,
  }
}

export function getBuildActions(state: GameState, propertyId: number): { canBuild: boolean; canSell: boolean; canMortgage: boolean; canUnmortgage: boolean } {
  const player = getCurrentPlayer(state)
  return {
    canBuild: canBuildOnProperty(state, propertyId, player.id),
    canSell: canSellBuilding(state, propertyId, player.id),
    canMortgage: canMortgageProperty(state, propertyId, player.id),
    canUnmortgage: canUnmortgageProperty(state, propertyId, player.id),
  }
}

export function getGroupStatus(state: GameState, group: ColorGroup, playerId: string): string {
  const owned = COLOR_GROUPS[group].filter((propertyId) => state.deeds[propertyId].ownerId === playerId).length
  return `${colorGroupLabel[group]} (${owned}/${COLOR_GROUPS[group].length})`
}
