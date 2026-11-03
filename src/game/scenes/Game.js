import * as Phaser from 'phaser';
import { Deck, buildDeck, deckSize } from '../logic/Deck';
import { Card, cardWidth, cardHeight } from '../objects/Card';

const maxHandSpacing = 110;
const rowMargin = 40;
const maxPileLayers = 5;
const pileLayerOffset = 2;
const startingHandSize = 7;
const maxTurns = 10; // total turns, shared by both players (5 each)
const benchPadding = 16;

const actionKinds = ['swap', 'destroy', 'remove', 'clear'];
const numberKinds = ['add', 'subtract'];
const operationKinds = ['multiply', 'amplify'];

export class Game extends Phaser.Scene {
  constructor() {
    super('Game');
  }

  create() {
    this.cameras.main.setBackgroundColor('#01b76b');
    this.deck = new Deck(buildDeck(deckSize));

    // Each player has a private hand and a public equation bench.
    this.players = [
      { name: 'Player 1', hand: [], bench: [] },
      { name: 'Player 2', hand: [], bench: [] },
    ];
    this.currentIndex = 0;
    this.turnNumber = 1;
    this.drawsRemaining = 1;
    this.extraDrawForNextPlayer = false;
    // Turns 1..maxTurns: 'draw' -> 'play' -> 'done'.
    // After the last turn: 'build' (each player assembles their equation in turn).
    this.phase = 'draw';

    this.actionPile = [];
    this.discardPile = [];
    this.gameEnded = false;
    this.handoffObjects = null;
    this.draggedCard = null;
    this.draggedLocation = null; // 'hand' or 'bench'

    this.computeLayout();
    this.createBenches();
    this.createPiles();
    this.createTexts();
    this.createButtons();
    this.setupDragging();
    this.setupPileDrops();

    this.refreshPile();
    this.refreshPileZones();
    this.dealStartingHands();
    this.refreshTurnText();
  }

  // ---- Layout and scene objects ----

  // Rows from top to bottom: Player 2 bench, piles, Player 1 bench, active hand.
  computeLayout() {
    const width = this.scale.width;
    const height = this.scale.height;

    this.benchHeight = cardHeight + benchPadding;
    this.handY = height - cardHeight / 2 - 20;
    this.benchYs = [
      this.handY - cardHeight / 2 - 40 - this.benchHeight / 2, // Player 1, above the hand
      70 + this.benchHeight / 2, // Player 2, top of the screen
    ];

    this.pileY = (this.benchYs[0] + this.benchYs[1]) / 2 - 12;
    this.pileX = width / 2;
    this.actionPileX = width / 2 - 260;
    this.discardPileX = width / 2 + 260;
  }

  createBenches() {
    const width = this.scale.width;
    this.benchLabels = this.players.map((player, i) => {
      const y = this.benchYs[i];
      this.add
        .rectangle(width / 2, y, width - rowMargin * 2 + benchPadding, this.benchHeight, 0xffffff, 0.12)
        .setStrokeStyle(2, 0xffffff)
        .setDepth(0);

      return this.add
        .text(
          width / 2,
          i === 0 ? y + this.benchHeight / 2 + 12 : y - this.benchHeight / 2 - 12,
          `${player.name.toUpperCase()} — EQUATION`,
          {
            fontSize: '16px',
            color: '#fff',
          },
        )
        .setOrigin(0.5)
        .setDepth(5000);
    });
  }

  createPileLayers(x, color) {
    const layers = [];
    for (let i = 0; i < maxPileLayers; i++) {
      const layer = this.add
        .rectangle(x - i * pileLayerOffset, this.pileY - i * pileLayerOffset, cardWidth, cardHeight, color)
        .setStrokeStyle(2, 0xffffff);
      layers.push(layer);
    }
    return layers;
  }

  createPiles() {
    this.pileLayers = this.createPileLayers(this.pileX, 0x3355aa);
    this.actionPileLayers = this.createPileLayers(this.actionPileX, 0x2d8f96);
    this.discardPileLayers = this.createPileLayers(this.discardPileX, 0x8d4d14);

    this.pileHitArea = this.add
      .zone(this.pileX, this.pileY, cardWidth + 10, cardHeight + 10)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.drawTopCard());

    this.actionPileHitArea = this.add
      .zone(this.actionPileX, this.pileY, cardWidth + 10, cardHeight + 10)
      .setRectangleDropZone(cardWidth + 10, cardHeight + 10)
      .setData('type', 'action');

    this.discardPileHitArea = this.add
      .zone(this.discardPileX, this.pileY, cardWidth + 10, cardHeight + 10)
      .setRectangleDropZone(cardWidth + 10, cardHeight + 10)
      .setData('type', 'discard');
  }

  createTexts() {
    const labelY = this.pileY + cardHeight / 2 + 24;

    this.countText = this.add
      .text(this.pileX, labelY, '', { fontSize: '20px', color: '#fff' })
      .setOrigin(0.5)
      .setDepth(5000);

    this.actionPileText = this.add
      .text(this.actionPileX, labelY, 'Function Cards', { fontSize: '18px', color: '#fff' })
      .setOrigin(0.5)
      .setDepth(5000);

    this.discardPileText = this.add
      .text(this.discardPileX, labelY, 'Discard', { fontSize: '18px', color: '#fff' })
      .setOrigin(0.5)
      .setDepth(5000);

    this.turnText = this.add
      .text(this.scale.width / 2, 28, '', { fontSize: '22px', color: '#fff', fontStyle: 'bold' })
      .setOrigin(0.5)
      .setDepth(6000);
  }

  createButtons() {
    const x = this.scale.width - rowMargin - 75;
    this.endTurnButton = this.createButton(x, this.pileY - 28, 'End Turn', () => this.endTurn());
    this.endGameButton = this.createButton(x, this.pileY + 28, 'End Game', () => this.endGame());
  }

  createButton(x, y, label, onClick) {
    const buttonWidth = 150;
    const buttonHeight = 42;

    const bg = this.add.rectangle(0, 0, buttonWidth, buttonHeight, 0x3d3d3d).setStrokeStyle(2, 0xffffff);
    const text = this.add
      .text(0, 0, label, { fontSize: '20px', color: '#fff', fontStyle: 'bold' })
      .setOrigin(0.5);

    const button = this.add.container(x, y, [bg, text]).setDepth(6000).setSize(buttonWidth, buttonHeight);
    button.setInteractive({ useHandCursor: true }).on('pointerdown', onClick);
    button.labelText = text; // so the label can change later (End Turn -> Done Building)
    return button;
  }

  // ---- Player helpers ----

  currentPlayer() {
    return this.players[this.currentIndex];
  }

  otherPlayer() {
    return this.players[1 - this.currentIndex];
  }

  // Where one of the current player's cards is: 'hand', 'bench', or null.
  locationOf(card) {
    const player = this.currentPlayer();
    if (player.hand.includes(card)) return 'hand';
    if (player.bench.includes(card)) return 'bench';
    return null;
  }

  createCard(cardData) {
    const card = new Card(this, 0, 0, cardData);
    card.showFace();
    return card;
  }

  dealStartingHands() {
    for (let round = 0; round < startingHandSize; round++) {
      for (const player of this.players) {
        const cardData = this.deck.drawTop();
        if (!cardData) break;
        player.hand.push(this.createCard(cardData));
      }
    }

    // Only the active player's hand is visible.
    this.players.forEach((player, i) => {
      player.hand.forEach((card) => card.setVisible(i === this.currentIndex));
    });

    this.layoutCurrentRows();
    this.refreshPile();
  }

  // ---- Row layout (hands and benches share the same spacing rules) ----

  rowSlots(count) {
    const availableWidth = this.scale.width - rowMargin * 2 - cardWidth;
    const spacing = count > 1 ? Math.min(maxHandSpacing, availableWidth / (count - 1)) : 0;
    const startX = this.scale.width / 2 - ((count - 1) * spacing) / 2;
    return { spacing, startX };
  }

  rowIndexForX(count, x) {
    const { spacing, startX } = this.rowSlots(count);
    if (count <= 1 || spacing === 0) return 0;
    const index = Math.round((x - startX) / spacing);
    return Phaser.Math.Clamp(index, 0, count - 1);
  }

  layoutRow(cards, y, animate = false) {
    const { spacing, startX } = this.rowSlots(cards.length);

    cards.forEach((card, i) => {
      // The card being dragged stays under the pointer and on top.
      if (card === this.draggedCard) return;

      card.setDepth(i + 1);
      const x = startX + i * spacing;

      this.tweens.killTweensOf(card);
      if (animate) {
        this.tweens.add({ targets: card, x, y, duration: 150, ease: 'Quad.easeOut' });
      } else {
        card.setPosition(x, y);
      }
    });
  }

  layoutHand(animate = false) {
    this.layoutRow(this.currentPlayer().hand, this.handY, animate);
  }

  layoutBench(playerIndex, animate = false) {
    this.layoutRow(this.players[playerIndex].bench, this.benchYs[playerIndex], animate);
  }

  layoutCurrentRows(animate = false) {
    this.layoutHand(animate);
    this.layoutBench(this.currentIndex, animate);
  }

  // Which of the current player's rows the pointer is over, if any.
  locationAtY(y) {
    const benchY = this.benchYs[this.currentIndex];
    if (Math.abs(y - benchY) <= this.benchHeight / 2 + 10) return 'bench';
    if (y >= this.handY - cardHeight / 2 - 15) return 'hand';
    return null;
  }

  // ---- Dragging: reorder your hand; during the build phase, also move cards to/from your bench ----

  setupDragging() {
    this.input.on('gameobjectdown', (pointer, gameObject) => {
      if (this.phase === 'dnaExchangeOpponent') {
        this.selectDnaExchangeOpponent(gameObject);
      } else if (this.phase === 'dnaExchangeOwn') {
        this.selectDnaExchangeOwn(gameObject);
      } else if (this.phase === 'sampleDestructionOpponent') {
        this.selectSampleDestructionOpponent(gameObject);
      }
    });

    this.input.on('dragstart', (pointer, card) => {
      if (
        this.gameEnded ||
        this.handoffObjects ||
        this.phase.startsWith('dnaExchange') ||
        this.phase === 'sampleDestructionOpponent'
      )
        return;
      const location = this.locationOf(card);
      if (!location) return; // not one of the current player's cards

      this.draggedCard = card;
      this.draggedLocation = location;
      this.tweens.killTweensOf(card);
      card.setDepth(1000);
    });

    this.input.on('drag', (pointer, card, dragX, dragY) => {
      if (card !== this.draggedCard) return;
      card.setPosition(dragX, dragY);

      const player = this.currentPlayer();
      // The bench only opens up once the turns are over.
      const target = this.phase === 'build' ? this.locationAtY(pointer.y) ?? this.draggedLocation : 'hand';
      const fromCards = player[this.draggedLocation];
      const oldIndex = fromCards.indexOf(card);
      if (oldIndex === -1) return;

      if (target === this.draggedLocation) {
        const newIndex = this.rowIndexForX(fromCards.length, dragX);
        if (newIndex !== oldIndex) {
          fromCards.splice(oldIndex, 1);
          fromCards.splice(newIndex, 0, card);
          this.layoutCurrentRows(true);
        }
        return;
      }

      // Moving between hand and bench.
      const toCards = player[target];
      fromCards.splice(oldIndex, 1);
      toCards.splice(this.rowIndexForX(toCards.length + 1, dragX), 0, card);
      this.draggedLocation = target;
      this.layoutCurrentRows(true);
    });

    this.input.on('dragend', (pointer, card) => {
      if (card !== this.draggedCard) return;
      this.draggedCard = null;
      this.draggedLocation = null;
      this.layoutCurrentRows(true);
    });
  }

  setupPileDrops() {
    this.input.on('drop', (pointer, card, dropZone) => {
      if (this.gameEnded || card !== this.draggedCard) return;
      const location = this.locationOf(card);
      if (!location) return;

      const zoneType = dropZone.getData('type');
      const isActionCard = actionKinds.includes(card.cardData.kind);

      // Returning early lets dragend slide the card back into its row.
      if (this.phase === 'build') {
        this.countText.setText('Turns are over: build your equation');
        return;
      }
      if (this.phase === 'draw') {
        this.countText.setText('Draw a card first');
        return;
      }
      if (this.phase === 'done') {
        this.countText.setText('Action used this turn');
        return;
      }
      if (zoneType === 'action' && !isActionCard) {
        this.countText.setText('Only function cards go there');
        return;
      }

      const cards = this.currentPlayer()[location];
      cards.splice(cards.indexOf(card), 1);
      card.disableInteractive();

      if (zoneType === 'action') {
        this.actionPile.push(card);
        const offset = (this.actionPile.length - 1) * 2;
        card.setDepth(100 + this.actionPile.length);
        card.setPosition(this.actionPileX + offset, this.pileY + offset);
        this.playFunctionCard(card);
      }

      if (zoneType === 'discard') {
        this.discardPile.push(card);
        const offset = (this.discardPile.length - 1) * 2;
        card.setDepth(100 + this.discardPile.length);
        card.setPosition(this.discardPileX + offset, this.pileY + offset);
      }

      if (
        this.phase !== 'labResetDraw' &&
        !this.phase.startsWith('dnaExchange') &&
        this.phase !== 'sampleDestructionOpponent'
      )
        this.phase = 'done';
      this.refreshPileZones();
      this.refreshTurnText();
    });
  }

  // ---- Function cards ----

  playFunctionCard(card) {
    if (card.cardData.kind === 'swap') {
      this.startDnaExchange();
    }
    if (card.cardData.kind === 'clear') {
      this.startLabReset();
    }
    if (card.cardData.kind === 'remove') {
      this.startSampleDestruction();
    }
  }

  startDnaExchange() {
    const opponent = this.otherPlayer();
    if (opponent.hand.length === 0 || this.currentPlayer().hand.length === 0) {
      this.phase = 'done';
      this.countText.setText('DNA Exchange needs cards in both hands · End Turn');
      this.refreshTurnText();
      return;
    }

    opponent.hand.forEach((card) => {
      card.showBack();
      card.setVisible(true);
    });
    this.layoutRow(opponent.hand, this.benchYs[1]);
    this.phase = 'dnaExchangeOpponent';
    this.countText.setText(`DNA Exchange: choose a card from ${opponent.name}`);
    this.refreshTurnText();
  }

  selectDnaExchangeOpponent(card) {
    if (this.phase !== 'dnaExchangeOpponent' || !this.otherPlayer().hand.includes(card)) return;

    this.dnaExchangeTarget = card;
    this.phase = 'dnaExchangeOwn';
    this.countText.setText('DNA Exchange: choose one of your cards to swap');
    this.refreshTurnText();
  }

  selectDnaExchangeOwn(card) {
    if (this.phase !== 'dnaExchangeOwn' || !this.currentPlayer().hand.includes(card)) return;

    const player = this.currentPlayer();
    const opponent = this.otherPlayer();
    const ownIndex = player.hand.indexOf(card);
    const opponentIndex = opponent.hand.indexOf(this.dnaExchangeTarget);
    const exchangedCard = this.dnaExchangeTarget;

    player.hand[ownIndex] = exchangedCard;
    opponent.hand[opponentIndex] = card;
    exchangedCard.showFace();
    card.showBack();
    this.dnaExchangeTarget = null;

    opponent.hand.forEach((opponentCard) => opponentCard.setVisible(true));
    player.hand.forEach((playerCard) => playerCard.setVisible(true));
    this.layoutHand();
    this.layoutRow(opponent.hand, this.benchYs[1]);
    this.phase = 'done';
    this.countText.setText('DNA Exchange complete · End Turn');
    this.refreshTurnText();
  }

  startSampleDestruction() {
    const opponent = this.otherPlayer();
    if (opponent.hand.length === 0) {
      this.phase = 'done';
      this.countText.setText('Sample Destruction: opponent has no cards · End Turn');
      this.refreshTurnText();
      return;
    }

    opponent.hand.forEach((card) => {
      card.showBack();
      card.setVisible(true);
    });
    this.layoutRow(opponent.hand, this.benchYs[1]);
    this.phase = 'sampleDestructionOpponent';
    this.countText.setText(`Sample Destruction: choose a card from ${opponent.name}`);
    this.refreshTurnText();
  }

  selectSampleDestructionOpponent(card) {
    if (this.phase !== 'sampleDestructionOpponent' || !this.otherPlayer().hand.includes(card)) return;

    const opponent = this.otherPlayer();
    opponent.hand.splice(opponent.hand.indexOf(card), 1);
    card.showFace();
    card.disableInteractive();

    this.discardPile.push(card);
    const offset = (this.discardPile.length - 1) * 2;
    card.setDepth(100 + this.discardPile.length);
    card.setPosition(this.discardPileX + offset, this.pileY + offset);
    opponent.hand.forEach((opponentCard) => opponentCard.setVisible(false));

    this.extraDrawForNextPlayer = true;
    this.phase = 'done';
    this.refreshPileZones();
    this.countText.setText('Sample Destruction complete · End Turn');
    this.refreshTurnText();
  }

  startLabReset() {
    const player = this.currentPlayer();
    player.hand.forEach((card) => card.destroy());
    player.hand = [];
    this.labResetDrawsRemaining = startingHandSize;
    this.phase = 'labResetDraw';
    this.layoutHand();
    this.countText.setText(`Lab Reset: draw ${this.labResetDrawsRemaining} cards`);
    this.refreshTurnText();
  }

  drawLabResetCard() {
    const cardData = this.deck.drawTop();
    if (!cardData) {
      this.labResetDrawsRemaining = 0;
      this.phase = 'done';
      this.countText.setText('Lab Reset: deck empty · End Turn');
      this.refreshPile();
      this.refreshTurnText();
      return;
    }

    this.currentPlayer().hand.push(this.createCard(cardData));
    this.labResetDrawsRemaining -= 1;
    this.layoutHand();
    this.refreshPile();

    if (this.labResetDrawsRemaining === 0) {
      this.phase = 'done';
      this.countText.setText('Lab Reset complete · End Turn');
    } else {
      this.countText.setText(`Lab Reset: draw ${this.labResetDrawsRemaining} more cards`);
    }
    this.refreshTurnText();
  }

  // SWAP: each player gives the other one random card from their hand.
  swapRandomCards() {
    const me = this.currentPlayer();
    const them = this.otherPlayer();

    if (me.hand.length === 0 || them.hand.length === 0) {
      this.countText.setText('Swap: a hand is empty, nothing swapped');
      return;
    }

    const mine = me.hand.splice(Phaser.Math.Between(0, me.hand.length - 1), 1)[0];
    const theirs = them.hand.splice(Phaser.Math.Between(0, them.hand.length - 1), 1)[0];

    this.tweens.killTweensOf(mine);
    mine.setVisible(false); // now in the other player's private hand
    them.hand.push(mine);

    theirs.setVisible(true);
    me.hand.push(theirs);

    this.countText.setText(`Swapped a card with ${them.name}`);
    // dragend (which fires right after this drop) re-lays out the hand.
  }

  // ---- Turn flow ----

  drawTopCard() {
    if (this.gameEnded || this.handoffObjects) return;

    if (this.phase === 'labResetDraw') {
      this.drawLabResetCard();
      return;
    }

    if (this.phase === 'build') {
      this.countText.setText('No more drawing: build your equation');
      return;
    }
    if (this.phase !== 'draw') {
      this.countText.setText('Already drew this turn');
      return;
    }

    const cardData = this.deck.drawTop();
    if (!cardData) {
      this.drawsRemaining = 0;
      this.phase = 'play';
      this.countText.setText('Deck empty');
      this.refreshTurnText();
      return;
    }

    this.currentPlayer().hand.push(this.createCard(cardData));
    this.drawsRemaining -= 1;
    if (this.drawsRemaining === 0) this.phase = 'play';

    this.layoutHand();
    this.refreshPile();
    if (this.phase === 'draw') this.countText.setText(`Draw ${this.drawsRemaining} more card`);
    this.refreshTurnText();
  }

  endTurn() {
    if (this.gameEnded || this.handoffObjects) return;
    const player = this.currentPlayer();

    if (this.phase.startsWith('dnaExchange')) {
      this.countText.setText(
        this.phase === 'dnaExchangeOpponent'
          ? 'Choose an opponent card first'
          : 'Choose one of your cards first',
      );
      return;
    }
    if (this.phase === 'sampleDestructionOpponent') {
      this.countText.setText('Choose an opponent card first');
      return;
    }

    if (this.phase === 'build') {
      this.finishBuilding();
      return;
    }

    if (this.phase === 'draw') {
      this.countText.setText('Draw a card first');
      return;
    }
    if (this.phase === 'play' && player.hand.length > 0) {
      this.countText.setText('Play a function card or discard a card first');
      return;
    }

    if (this.turnNumber >= maxTurns) {
      this.startBuildPhase();
      return;
    }

    this.labResetDrawsRemaining = null;
    this.turnNumber += 1;
    this.currentIndex = 1 - this.currentIndex;
    this.drawsRemaining = this.extraDrawForNextPlayer ? 2 : 1;
    this.extraDrawForNextPlayer = false;
    this.phase = this.deck.remaining > 0 ? 'draw' : 'play';
    this.refreshPile();
    this.showHandoff();
  }

  // After the last turn, Player 1 builds first, then Player 2.
  // Each player builds privately; both benches are revealed when scoring.
  startBuildPhase() {
    this.phase = 'build';
    this.currentIndex = 0;
    this.endTurnButton.labelText.setText('Done Building');
    this.showHandoff();
  }

  finishBuilding() {
    const player = this.currentPlayer();
    const unusedNumbers = player.hand.filter((card) => numberKinds.includes(card.cardData.kind));
    if (unusedNumbers.length > 0) {
      this.countText.setText(`Use all your numbers (${unusedNumbers.length} left in hand)`);
      return;
    }

    if (this.currentIndex === 0) {
      this.currentIndex = 1;
      this.showHandoff();
    } else {
      this.endGame();
    }
  }

  // Covers the screen between turns so the next player's hand isn't revealed early.
  showHandoff() {
    this.players.forEach((player) => {
      player.hand.forEach((card) => card.setVisible(false));
      // While building, each bench stays private until the final reveal.
      if (this.phase === 'build') player.bench.forEach((card) => card.setVisible(false));
    });

    const { width, height } = this.scale;
    const message =
      this.phase === 'build'
        ? `${this.currentPlayer().name}: build your equation\n\nClick to reveal your hand`
        : `${this.currentPlayer().name}'s turn\n\nClick to reveal your hand`;
    const bg = this.add
      .rectangle(width / 2, height / 2, width, height, 0x000000, 0.85)
      .setDepth(9000)
      .setInteractive();
    const text = this.add
      .text(width / 2, height / 2, message, {
        fontSize: '28px',
        color: '#fff',
        align: 'center',
      })
      .setOrigin(0.5)
      .setDepth(9001);

    this.handoffObjects = [bg, text];
    bg.once('pointerdown', () => this.hideHandoff());
    this.refreshTurnText();
  }

  hideHandoff() {
    this.handoffObjects.forEach((obj) => obj.destroy());
    this.handoffObjects = null;

    const player = this.currentPlayer();
    player.hand.forEach((card) => {
      card.showFace();
      card.setVisible(true);
    });
    if (this.phase === 'build') player.bench.forEach((card) => card.setVisible(true));
    this.layoutCurrentRows();
    this.refreshTurnText();
  }

  refreshTurnText() {
    if (this.gameEnded) return;
    const name = this.currentPlayer().name;

    if (this.phase === 'labResetDraw') {
      this.turnText.setText(`Lab Reset · ${name}: draw ${this.labResetDrawsRemaining} cards`);
      return;
    }
    if (this.phase === 'dnaExchangeOpponent') {
      this.turnText.setText(`DNA Exchange · ${name}: choose an opponent card`);
      return;
    }
    if (this.phase === 'dnaExchangeOwn') {
      this.turnText.setText(`DNA Exchange · ${name}: choose your card`);
      return;
    }
    if (this.phase === 'sampleDestructionOpponent') {
      this.turnText.setText(`Sample Destruction · ${name}: choose an opponent card`);
      return;
    }
    if (this.phase === 'done' && this.labResetDrawsRemaining === 0 && this.currentPlayer().hand.length > 0) {
      this.turnText.setText(`Lab Reset · ${name}: End Turn`);
      return;
    }

    if (this.phase === 'build') {
      this.turnText.setText(`Build phase · ${name}: drag cards onto your equation, then Done Building`);
      return;
    }

    const isLastTurn = this.turnNumber >= maxTurns;
    const instructions = {
      draw: 'draw a card',
      play: 'play a function card or discard a card',
      done: isLastTurn ? 'End Turn to start building equations' : 'End Turn',
    };

    const instruction = this.phase === 'draw' ? `draw ${this.drawsRemaining} card${this.drawsRemaining === 1 ? '' : 's'}` : instructions[this.phase];
    this.turnText.setText(`Turn ${this.turnNumber}/${maxTurns} · ${name}: ${instruction}`);
  }

  // ---- Piles ----

  visibleLayerCount() {
    const remaining = this.deck.remaining;
    if (remaining === 0) return 0;
    return Math.min(maxPileLayers, Math.ceil((remaining / deckSize) * maxPileLayers));
  }

  refreshPile() {
    const visible = this.visibleLayerCount();
    this.pileLayers.forEach((layer, i) => layer.setVisible(i < visible));

    if (this.deck.remaining === 0) {
      this.pileHitArea.disableInteractive();
      this.countText.setText('Pile empty');
    } else {
      this.countText.setText(`${this.deck.remaining} cards`);
    }
  }

  refreshPileZones() {
    this.actionPileText.setText(`Function Cards: ${this.actionPile.length}`);
    this.discardPileText.setText(`Discard: ${this.discardPile.length}`);

    this.actionPileLayers.forEach((layer, i) => {
      layer.setVisible(i < Math.min(maxPileLayers, this.actionPile.length));
      layer.setDepth(10 + i);
    });

    this.discardPileLayers.forEach((layer, i) => {
      layer.setVisible(i < Math.min(maxPileLayers, this.discardPile.length));
      layer.setDepth(10 + i);
    });
  }

  // ---- Scoring ----

  // Follows the board rules: number cards keep their signs; × and power cards attach
  // to the number before them; powers first, then ×, then + / −.
  // Unpaired operation cards (nothing before them) and function cards don't count.
  evaluateEquation(cards) {
    const terms = [];

    for (const card of cards) {
      const kind = card.cardData.kind;
      const value = Number(card.cardData.value) || 0;

      if (numberKinds.includes(kind)) {
        const sign = kind === 'subtract' || value < 0 ? -1 : 1;
        terms.push({ sign, factors: [{ base: Math.abs(value), power: 1 }] });
      } else if (operationKinds.includes(kind) && terms.length > 0) {
        const term = terms[terms.length - 1];
        if (kind === 'multiply') term.factors.push({ base: value, power: 1 });
        if (kind === 'amplify') term.factors[term.factors.length - 1].power *= value;
      }
    }

    let total = 0;
    let text = '';
    terms.forEach((term, i) => {
      const product = term.factors.reduce((acc, f) => acc * Math.pow(f.base, f.power), 1);
      total += term.sign * product;

      const factorText = term.factors
        .map((f) => (f.power === 1 ? `${f.base}` : `${f.base}^${f.power}`))
        .join(' × ');

      if (i === 0) text += term.sign < 0 ? `−${factorText}` : factorText;
      else text += term.sign < 0 ? ` − ${factorText}` : ` + ${factorText}`;
    });

    return { total, text };
  }

  endGame() {
    if (this.gameEnded) return;
    this.gameEnded = true;

    if (this.handoffObjects) {
      this.handoffObjects.forEach((obj) => obj.destroy());
      this.handoffObjects = null;
    }

    // Reveal both equations; hide hands.
    this.players.forEach((player, i) => {
      player.hand.forEach((card) => card.setVisible(false));
      player.bench.forEach((card) => card.setVisible(true));
      this.layoutBench(i);
    });

    const totals = this.players.map((player, i) => {
      const { total, text } = this.evaluateEquation(player.bench);
      this.benchLabels[i].setText(`${player.name.toUpperCase()} — ${text || 'no equation'} = ${total}`);
      return total;
    });

    let outcome = 'Tie!';
    if (totals[0] > totals[1]) outcome = `${this.players[0].name} wins!`;
    if (totals[1] > totals[0]) outcome = `${this.players[1].name} wins!`;
    this.turnText.setText(`Game over · ${outcome}`);

    this.pileHitArea.disableInteractive();
    this.input.enabled = false;
  }
}