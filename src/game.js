// ═══════════════════════════════════════════════════════
//  GAME — Assembly
//  Combines state, actions and phases into a single class
//  via prototype mixin. No logic lives here.
// ═══════════════════════════════════════════════════════
export { _setUIFunctions } from './engine/uiStore.js';

import { GameState } from './engine/GameState.js';
import * as actions from './engine/GameActions.js';
import * as phases  from './engine/GamePhases.js';

export class Game extends GameState {}
Object.assign(Game.prototype, actions, phases);
