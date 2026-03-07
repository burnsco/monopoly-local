import { BOARD_SPACES, COLOR_GROUPS, RAILROAD_IDS, UTILITY_IDS, colorGroupLabel } from './data/board'
import type { BoardSpace, ColorGroup, DeedState, GameState, PlayerState, PropertySpace } from './types'

export function getCurrentPlayer(state: GameState): PlayerState {
  return state.players[state.currentPlayerIndex]
}

export function getSpace(index: number): BoardSpace {
  return BOARD_SPACES[index]
}

export function getDeed(state: GameState, propertyId: number): DeedState {
  return state.deeds[propertyId]
}

export function getPlayerById(state: GameState, playerId: string): PlayerState | undefined {
  return state.players.find((player) => player.id === playerId)
}

export function getOwnedPropertyIds(state: GameState, playerId: string): number[] {
  return Object.entries(state.deeds)
    .filter(([, deed]) => deed.ownerId === playerId)
    .map(([propertyId]) => Number(propertyId))
    .sort((left, right) => left - right)
}

export function getActivePlayers(state: GameState): PlayerState[] {
  return state.players.filter((player) => !player.bankrupt)
}

export function isPropertySpace(space: BoardSpace): space is PropertySpace {
  return space.type === 'property'
}

export function ownsFullColorSet(state: GameState, playerId: string, group: ColorGroup): boolean {
  return COLOR_GROUPS[group].every((propertyId) => {
    const deed = state.deeds[propertyId]
    return deed.ownerId === playerId && !deed.mortgaged
  })
}

export function getColorGroupLevels(state: GameState, group: ColorGroup): number[] {
  return COLOR_GROUPS[group].map((propertyId) => {
    const deed = state.deeds[propertyId]
    return deed.hotel ? 5 : deed.houses
  })
}

export function getPropertyLevel(deed: DeedState): number {
  return deed.hotel ? 5 : deed.houses
}

export function getRailroadCount(state: GameState, playerId: string): number {
  return RAILROAD_IDS.filter((propertyId) => state.deeds[propertyId].ownerId === playerId && !state.deeds[propertyId].mortgaged).length
}

export function getUtilityCount(state: GameState, playerId: string): number {
  return UTILITY_IDS.filter((propertyId) => state.deeds[propertyId].ownerId === playerId && !state.deeds[propertyId].mortgaged).length
}

export function getPlayerNetWorthEstimate(state: GameState, playerId: string): number {
  const player = getPlayerById(state, playerId)

  if (!player) {
    return 0
  }

  return getOwnedPropertyIds(state, playerId).reduce((total, propertyId) => {
    const deed = state.deeds[propertyId]
    const space = getSpace(propertyId)

    if (space.type === 'property') {
      const level = getPropertyLevel(deed)
      return total + space.mortgageValue + level * (space.houseCost / 2)
    }

    if (space.type === 'railroad' || space.type === 'utility') {
      return total + space.mortgageValue
    }

    return total
  }, player.money)
}

export function getPropertyDetailsSummary(state: GameState, propertyId: number): string {
  const space = getSpace(propertyId)
  const deed = getDeed(state, propertyId)

  if (space.type === 'property') {
    const owner = deed.ownerId ? getPlayerById(state, deed.ownerId)?.name ?? 'Unknown' : 'Unowned'
    const status = deed.mortgaged ? 'Mortgaged' : deed.hotel ? 'Hotel' : deed.houses > 0 ? `${deed.houses} house${deed.houses === 1 ? '' : 's'}` : 'No buildings'
    return `${colorGroupLabel[space.colorGroup]} | ${owner} | ${status}`
  }

  if (space.type === 'railroad' || space.type === 'utility') {
    const owner = deed.ownerId ? getPlayerById(state, deed.ownerId)?.name ?? 'Unknown' : 'Unowned'
    return `${space.type === 'railroad' ? 'Railroad' : 'Utility'} | ${owner}${deed.mortgaged ? ' | Mortgaged' : ''}`
  }

  return space.name
}

export function getSpaceMoneyLabel(spaceIndex: number): string {
  const space = getSpace(spaceIndex)

  if ('price' in space) {
    return `$${space.price}`
  }

  if (space.type === 'tax') {
    return `$${space.amount}`
  }

  return ''
}
