import { create } from 'zustand'
import {
  acknowledgeCard,
  advanceMovementOneStep,
  buildHouseOrHotel,
  buyPendingProperty,
  declareBankruptcy,
  declinePendingProperty,
  endTurn,
  mortgageProperty,
  payBail,
  playGetOutOfJailCard,
  placeAuctionBid,
  rollDiceForCurrentPlayer,
  selectSpace,
  sellBuilding,
  settleDebtIfPossible,
  unmortgageProperty,
  passAuctionTurn,
} from './engine'
import { createGame } from './setup'
import { loadGame, saveGame, clearSavedGame } from './storage'
import type { GameState, PlayerSetup } from './types'

interface GameStore {
  game: GameState | null
  diceRolling: boolean
  hasSavedGame: boolean
  
  // Actions
  setGame: (game: GameState | null) => void
  startGame: (players: PlayerSetup[]) => void
  loadSavedGame: () => void
  clearSavedGame: () => void
  
  rollDice: () => void
  setDiceRolling: (rolling: boolean) => void
  
  advanceMovement: () => void
  payBail: () => void
  playGetOutOfJailCard: () => void
  buyProperty: () => void
  declineProperty: () => void
  acknowledgeCard: () => void
  endTurn: () => void
  settleDebt: () => void
  declareBankruptcy: () => void
  buildHouse: (propertyId: number) => void
  sellBuilding: (propertyId: number) => void
  mortgage: (propertyId: number) => void
  unmortgage: (propertyId: number) => void
  setSelectedSpace: (spaceIndex: number | null) => void
  placeBid: (amount: number) => void
  passAuction: () => void
}

export const useGameStore = create<GameStore>((set, get) => ({
  game: null,
  diceRolling: false,
  hasSavedGame: loadGame() !== null,

  setGame: (game) => {
    set({ game })
    if (game) saveGame(game)
  },

  startGame: (players) => {
    const game = createGame(players)
    set({ game, hasSavedGame: true })
    saveGame(game)
  },

  loadSavedGame: () => {
    const saved = loadGame()
    if (saved) set({ game: saved, hasSavedGame: true })
  },

  clearSavedGame: () => {
    clearSavedGame()
    set({ game: null, hasSavedGame: false })
  },

  setDiceRolling: (diceRolling) => set({ diceRolling }),

  rollDice: () => {
    const { game } = get()
    if (!game) return
    
    set({ diceRolling: true })
    const nextGame = rollDiceForCurrentPlayer(game)
    set({ game: nextGame })
    saveGame(nextGame)
    
    setTimeout(() => set({ diceRolling: false }), 700)
  },

  advanceMovement: () => {
    const { game } = get()
    if (!game) return
    const nextGame = advanceMovementOneStep(game)
    set({ game: nextGame })
    saveGame(nextGame)
  },

  payBail: () => {
    const { game } = get()
    if (!game) return
    const nextGame = payBail(game)
    set({ game: nextGame })
    saveGame(nextGame)
  },

  playGetOutOfJailCard: () => {
    const { game } = get()
    if (!game) return
    const nextGame = playGetOutOfJailCard(game)
    set({ game: nextGame })
    saveGame(nextGame)
  },

  buyProperty: () => {
    const { game } = get()
    if (!game) return
    const nextGame = buyPendingProperty(game)
    set({ game: nextGame })
    saveGame(nextGame)
  },

  declineProperty: () => {
    const { game } = get()
    if (!game) return
    const nextGame = declinePendingProperty(game)
    set({ game: nextGame })
    saveGame(nextGame)
  },

  acknowledgeCard: () => {
    const { game } = get()
    if (!game) return
    const nextGame = acknowledgeCard(game)
    set({ game: nextGame })
    saveGame(nextGame)
  },

  endTurn: () => {
    const { game } = get()
    if (!game) return
    const nextGame = endTurn(game)
    set({ game: nextGame })
    saveGame(nextGame)
  },

  settleDebt: () => {
    const { game } = get()
    if (!game) return
    const nextGame = settleDebtIfPossible(game)
    set({ game: nextGame })
    saveGame(nextGame)
  },

  declareBankruptcy: () => {
    const { game } = get()
    if (!game) return
    const nextGame = declareBankruptcy(game)
    set({ game: nextGame })
    saveGame(nextGame)
  },

  buildHouse: (propertyId) => {
    const { game } = get()
    if (!game) return
    const nextGame = buildHouseOrHotel(game, propertyId)
    set({ game: nextGame })
    saveGame(nextGame)
  },

  sellBuilding: (propertyId) => {
    const { game } = get()
    if (!game) return
    const nextGame = sellBuilding(game, propertyId)
    set({ game: nextGame })
    saveGame(nextGame)
  },

  mortgage: (propertyId) => {
    const { game } = get()
    if (!game) return
    const nextGame = mortgageProperty(game, propertyId)
    set({ game: nextGame })
    saveGame(nextGame)
  },

  unmortgage: (propertyId) => {
    const { game } = get()
    if (!game) return
    const nextGame = unmortgageProperty(game, propertyId)
    set({ game: nextGame })
    saveGame(nextGame)
  },

  setSelectedSpace: (spaceIndex) => {
    const { game } = get()
    if (!game) return
    const nextGame = selectSpace(game, spaceIndex)
    set({ game: nextGame })
  },

  placeBid: (amount) => {
    const { game } = get()
    if (!game) return
    const nextGame = placeAuctionBid(game, amount)
    set({ game: nextGame })
    saveGame(nextGame)
  },

  passAuction: () => {
    const { game } = get()
    if (!game) return
    const nextGame = passAuctionTurn(game)
    set({ game: nextGame })
    saveGame(nextGame)
  },
}))
