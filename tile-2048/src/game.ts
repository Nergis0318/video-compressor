// Pure 2048 rules. No host APIs, no DOM: this file is the part of the game a
// hardware target can compile without a browser.

export const SIZE = 4
export const CELL_COUNT = SIZE * SIZE

export type Direction = 'up' | 'down' | 'left' | 'right'

/** A board is 16 cells in row-major order; 0 means empty. */
export type Board = number[]

/**
 * Cell indices per line, ordered from the edge tiles travel TOWARD, which is
 * the order a merge has to resolve: the tile nearest the wall pairs first, so
 * [2, 2, 4] sliding left becomes [4, 4] and never [8, 0].
 */
function buildOrder(direction: Direction): number[][] {
  const lines: number[][] = []
  for (let line = 0; line < SIZE; line++) {
    const cells: number[] = []
    for (let step = 0; step < SIZE; step++) {
      if (direction === 'left') cells.push(line * SIZE + step)
      else if (direction === 'right') cells.push(line * SIZE + (SIZE - 1 - step))
      else if (direction === 'up') cells.push(step * SIZE + line)
      else cells.push((SIZE - 1 - step) * SIZE + line)
    }
    lines.push(cells)
  }
  return lines
}

const ORDERS: { [key: string]: number[][] } = {
  up: buildOrder('up'),
  right: buildOrder('right'),
  down: buildOrder('down'),
  left: buildOrder('left'),
}

export function emptyBoard(): Board {
  const board: number[] = []
  for (let i = 0; i < CELL_COUNT; i++) board.push(0)
  return board
}

export interface MoveResult {
  board: Board
  score: number
  moved: boolean
}

export function move(board: Board, direction: Direction): MoveResult {
  const lines = ORDERS[direction]
  const next = board.slice()
  let score = 0
  let moved = false

  for (let line = 0; line < lines.length; line++) {
    const cells = lines[line]

    const values: number[] = []
    for (let step = 0; step < cells.length; step++) {
      const value = board[cells[step]]
      if (value !== 0) values.push(value)
    }

    const merged: number[] = []
    let i = 0
    while (i < values.length) {
      if (i + 1 < values.length && values[i] === values[i + 1]) {
        const doubled = values[i] * 2
        merged.push(doubled)
        score += doubled
        i += 2
      } else {
        merged.push(values[i])
        i += 1
      }
    }

    for (let step = 0; step < cells.length; step++) {
      const value = step < merged.length ? merged[step] : 0
      const index = cells[step]
      if (next[index] !== value) moved = true
      next[index] = value
    }
  }

  return { board: next, score, moved }
}

export interface SpawnResult {
  board: Board
  index: number
}

/** Put a 2 (10% chance: a 4) on a random empty cell. index is -1 when full. */
export function spawn(board: Board): SpawnResult {
  const empty: number[] = []
  for (let i = 0; i < board.length; i++) if (board[i] === 0) empty.push(i)
  if (empty.length === 0) return { board, index: -1 }

  const index = empty[Math.floor(Math.random() * empty.length)]
  const next = board.slice()
  next[index] = Math.random() < 0.1 ? 4 : 2
  return { board: next, index }
}

export function hasEmptyCell(board: Board): boolean {
  for (let i = 0; i < board.length; i++) if (board[i] === 0) return true
  return false
}

/** True when at least one direction still changes the board. */
export function canMove(board: Board): boolean {
  if (hasEmptyCell(board)) return true
  for (let row = 0; row < SIZE; row++) {
    for (let col = 0; col < SIZE; col++) {
      const index = row * SIZE + col
      const value = board[index]
      if (col + 1 < SIZE && board[index + 1] === value) return true
      if (row + 1 < SIZE && board[index + SIZE] === value) return true
    }
  }
  return false
}

/** A fresh board: two tiles, score zero. */
export function newGame(): Board {
  const first = spawn(emptyBoard())
  const second = spawn(first.board)
  return second.board
}

/** True when any cell holds `value`. */
export function hasTile(board: Board, value: number): boolean {
  for (let i = 0; i < board.length; i++) if (board[i] === value) return true
  return false
}

/** CSS class for one cell — the palette lives in styles.css. */
export function tileClass(value: number): string {
  if (value === 0) return 'tile empty'
  if (value > 2048) return 'tile tile-super'
  return 'tile tile-' + value
}
