import { ReactiveComponent } from '@geastack/core'
import { Board, Direction, canMove, hasTile, move, newGame, spawn, tileClass } from './game'
import './styles.css'

const BEST_KEY = 'tile-2048.best'

type Status = 'playing' | 'won' | 'over'

/**
 * Put focus back on the app root. The DOM build routes `keydown` up from the
 * focused node, and dismissing an overlay (its button disappears) drops focus
 * to <body> — one level above the root, where the root's handler never runs.
 */
export function focusRoot(): void {
  const screen = document.querySelector('.screen')
  if (!screen) return
  screen.setAttribute('tabindex', '0')
  screen.focus()
}

function readBest(): number {
  const stored = localStorage.getItem(BEST_KEY)
  if (stored.length === 0) return 0
  const value = parseInt(stored)
  return isNaN(value) ? 0 : value
}

export class App extends ReactiveComponent {
  cells: Board = newGame()
  score = 0
  best = readBest()
  status: Status = 'playing'

  handleMove(direction: Direction): void {
    if (this.status === 'over') return

    const result = move(this.cells, direction)
    if (!result.moved) return

    const spawned = spawn(result.board)
    this.applyBoard(spawned.board)
    this.score = this.score + result.score
    if (this.score > this.best) {
      this.best = this.score
      localStorage.setItem(BEST_KEY, String(this.best))
    }

    if (this.status !== 'won' && hasTile(spawned.board, 2048)) {
      this.status = 'won'
      return
    }
    if (!canMove(spawned.board)) this.status = 'over'
  }

  // The board array keeps its identity: the list renderer reconciles by index,
  // so writing the 16 cells in place patches classes and text instead of
  // tearing the grid down and rebuilding it.
  applyBoard(next: Board): void {
    for (let i = 0; i < next.length; i++) this.cells[i] = next[i]
  }

  keepPlaying(): void {
    if (this.status === 'won') this.status = 'playing'
    focusRoot()
  }

  reset(): void {
    this.applyBoard(newGame())
    this.score = 0
    this.status = 'playing'
    focusRoot()
  }

  // Arrow keys and WASD; R restarts. Bound on the root element, where the
  // engine treats keydown as an app-level shortcut and the DOM build
  // delegates it up the focused node's ancestors.
  onKey(keyCode: number): void {
    if (keyCode === 37 || keyCode === 65) this.handleMove('left')
    else if (keyCode === 38 || keyCode === 87) this.handleMove('up')
    else if (keyCode === 39 || keyCode === 68) this.handleMove('right')
    else if (keyCode === 40 || keyCode === 83) this.handleMove('down')
    else if (keyCode === 82) this.reset()
  }

  template() {
    const playing = this.status === 'playing'
    const won = this.status === 'won'

    return (
      <div class="screen" onKeyDown={event => this.onKey(event.keyCode)}>
        <div class="topbar">
          <div class="brand">
            <span class="eyebrow">GEASTACK</span>
            <span class="title">2048</span>
          </div>
          <div class="scores">
            <div class="score-box">
              <span class="score-label">SCORE</span>
              <span class="score-value">{this.score}</span>
            </div>
            <div class="score-box">
              <span class="score-label">BEST</span>
              <span class="score-value">{this.best}</span>
            </div>
          </div>
        </div>

        <div class="board-wrap">
          <div class="board">
            {this.cells.map((value, index) => <div key={index} class={tileClass(value)}>{value > 0 ? String(value) : ''}</div>)}
          </div>
          <div class={playing ? 'overlay' : 'overlay visible'}>
            <span class="overlay-title">{won ? 'You made 2048!' : 'Game over'}</span>
            <span class="overlay-text">Score {this.score}</span>
            <div class="overlay-actions">
              <button class={won ? 'button primary' : 'button primary hidden'} onClick={() => this.keepPlaying()}>
                Keep going
              </button>
              <button class="button secondary" onClick={() => this.reset()}>
                New game
              </button>
            </div>
          </div>
        </div>

        <div class="pad">
          <div class="pad-row">
            <button class="pad-key" onClick={() => this.handleMove('up')}>↑</button>
          </div>
          <div class="pad-row">
            <button class="pad-key" onClick={() => this.handleMove('left')}>←</button>
            <button class="pad-key" onClick={() => this.handleMove('down')}>↓</button>
            <button class="pad-key" onClick={() => this.handleMove('right')}>→</button>
          </div>
        </div>

        <div class="hint">
          <span class="hint-text">Arrow keys or WASD to move · R to restart</span>
          <button class="button secondary" onClick={() => this.reset()}>New game</button>
        </div>
      </div>
    )
  }
}
