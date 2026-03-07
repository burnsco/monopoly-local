import { describe, expect, it } from 'vitest'

import { acknowledgeCard, buildHouseOrHotel, buyPendingProperty, getBuildActions, playGetOutOfJailCard } from '../src/game/engine'
import { createGame } from '../src/game/setup'
import type { GameState } from '../src/game/types'

function withGame(mutator: (state: GameState) => GameState): GameState {
  return mutator(
    createGame([
      { name: 'Ada', token: 'Top Hat', color: '#e4572e' },
      { name: 'Grace', token: 'Battleship', color: '#4f86f7' },
    ]),
  )
}

describe('game engine', () => {
  it('buys a pending property and assigns ownership', () => {
    const game = withGame((state) => ({
      ...state,
      phase: 'await_purchase',
      pendingPurchase: { propertyId: 1 },
    }))

    const next = buyPendingProperty(game)

    expect(next.deeds[1].ownerId).toBe('player-1')
    expect(next.players[0].money).toBe(1440)
    expect(next.phase).toBe('await_end_turn')
  })

  it('keeps an earned extra turn after a card is acknowledged', () => {
    const game = withGame((state) => ({
      ...state,
      phase: 'show_card',
      extraTurn: true,
      pendingCard: {
        deck: 'chance',
        cardId: 'chance-bank-dividend',
        description: 'Bank pays you dividend of $50.',
      },
    }))

    const next = acknowledgeCard(game)

    expect(next.extraTurn).toBe(true)
    expect(next.phase).toBe('await_end_turn')
    expect(next.players[0].money).toBe(1550)
  })

  it('enforces even building across a complete color set', () => {
    const game = withGame((state) => ({
      ...state,
      deeds: {
        ...state.deeds,
        1: { ...state.deeds[1], ownerId: 'player-1' },
        3: { ...state.deeds[3], ownerId: 'player-1' },
      },
    }))

    const afterFirstBuild = buildHouseOrHotel(game, 1)
    const firstActions = getBuildActions(afterFirstBuild, 1)
    const secondActions = getBuildActions(afterFirstBuild, 3)

    expect(afterFirstBuild.deeds[1].houses).toBe(1)
    expect(firstActions.canBuild).toBe(false)
    expect(secondActions.canBuild).toBe(true)
  })

  it('uses a get out of jail card without consuming the roll phase', () => {
    const game = withGame((state) => ({
      ...state,
      players: state.players.map((player, index) => (
        index === 0
          ? {
              ...player,
              inJail: true,
              jailTurns: 2,
              getOutOfJailCards: ['chance'],
            }
          : player
      )),
    }))

    const next = playGetOutOfJailCard(game)

    expect(next.players[0].inJail).toBe(false)
    expect(next.players[0].jailTurns).toBe(0)
    expect(next.players[0].getOutOfJailCards).toEqual([])
    expect(next.decks.chance.discardPile).toContain('chance-get-out')
    expect(next.phase).toBe('await_roll')
  })
})
