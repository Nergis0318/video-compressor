import { mount } from '@geastack/core'
import { App, focusRoot } from './App'

mount(App)

// A freshly loaded page has focus on <body> — one level above the app root, so
// the root's own keydown handler would never see the first arrow key. Seeding
// focus puts every later key on the same path (clicking a control moves focus
// to that button, still inside the root).
focusRoot()
