import * as Phaser from 'phaser';
import { Deck, buildDeck, deckSize } from '../logic/Deck';
import { Card, cardWidth, cardHeight } from '../objects/Card';

const maxHandSpacing = 110;
const handMargin = 40;
const maxPileLayers = 5;
const pileLayerOffset = 2;
const maxHandSize = 7;
const maxTurns = 10;

export class Game extends Phaser.Scene {
  constructor() {
    super('Game');
  }

  create() {
    this.cameras.main.setBackgroundColor('#01b76b');
    this.deck = new Deck(buildDeck(deckSize));
    this.hand = [];
    this.actionPile = [];
    this.discardPile = [];
    this.gameEnded = false;
    this.turnNumber = 0;
    this.turnActionUsed = false;
    this.awaitingDraw = false;

    this.pileX = this.scale.width / 2;
    this.pileY = this.scale.height / 2 - 80;
    this.actionPileX = this.scale.width / 2 - 260;
    this.discardPileX = this.scale.width / 2 + 260;
    this.actionPileY = this.scale.height / 2 - 80;
    this.discardPileY = this.scale.height / 2 - 80;

    this.pileLayers = [];
    for (let i = 0; i < maxPileLayers; i++) {
      const layer = this.add
        .rectangle(
          this.pileX - i * pileLayerOffset,
          this.pileY - i * pileLayerOffset,
          cardWidth,
          cardHeight,
          0x3355aa
        )
        .setStrokeStyle(2, 0xffffff);
      this.pileLayers.push(layer);
    }

    this.actionPileLayers = [];
    for (let i = 0; i < maxPileLayers; i++) {
      const layer = this.add
        .rectangle(
          this.actionPileX - i * pileLayerOffset,
          this.actionPileY - i * pileLayerOffset,
          cardWidth,
          cardHeight,
          0x2d8f96
        )
        .setStrokeStyle(2, 0xffffff);
      this.actionPileLayers.push(layer);
    }

    this.discardPileLayers = [];
    for (let i = 0; i < maxPileLayers; i++) {
      const layer = this.add
        .rectangle(
          this.discardPileX - i * pileLayerOffset,
          this.discardPileY - i * pileLayerOffset,
          cardWidth,
          cardHeight,
          0x8d4d14
        )
        .setStrokeStyle(2, 0xffffff);
      this.discardPileLayers.push(layer);
    }

    this.pileHitArea = this.add
      .zone(this.pileX, this.pileY, cardWidth + 10, cardHeight + 10)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.drawTopCard());

    this.actionPileHitArea = this.add
      .zone(this.actionPileX, this.actionPileY, cardWidth + 10, cardHeight + 10)
      .setRectangleDropZone(cardWidth + 10, cardHeight + 10)
      .setData('type', 'action');

    this.discardPileHitArea = this.add
      .zone(this.discardPileX, this.discardPileY, cardWidth + 10, cardHeight + 10)
      .setRectangleDropZone(cardWidth + 10, cardHeight + 10)
      .setData('type', 'discard');

    this.countText = this.add
      .text(this.pileX, this.pileY + cardHeight / 2 + 24, '', { fontSize: '20px', color: '#fff' })
      .setOrigin(0.5);

    this.actionPileText = this.add
      .text(this.actionPileX, this.actionPileY + cardHeight / 2 + 26, 'Action Pile', { fontSize: '18px', color: '#fff' })
      .setOrigin(0.5)
      .setDepth(5000);

    this.discardPileText = this.add
      .text(this.discardPileX, this.discardPileY + cardHeight / 2 + 26, 'Discard', { fontSize: '18px', color: '#fff' })
      .setOrigin(0.5)
      .setDepth(5000);

    this.scoreText = this.add
      .text(this.scale.width / 2, this.scale.height - cardHeight - 85, 'Score: 0', {
        fontSize: '24px',
        color: '#fff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setVisible(false);

    this.turnText = this.add
      .text(this.scale.width / 2, 28, 'Your Turn', {
        fontSize: '22px',
        color: '#fff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(6000);

    this.createEndGameButton();

    this.draggedCard = null;
    this.awaitingDraw = false;
    this.turnActionUsed = false;
    this.setupHandDragging();
    this.setupPileDrops();

    this.refreshPile();
    this.refreshPileZones();
    this.dealStartingHand();
    this.refreshTurnText();
  }

  createEndGameButton() {
    const buttonWidth = 150;
    const buttonHeight = 42;
    const x = 30;
    const y = 30;

    const buttonBg = this.add
      .rectangle(x + buttonWidth / 2, y + buttonHeight / 2, buttonWidth, buttonHeight, 0x3d3d3d)
      .setStrokeStyle(2, 0xffffff);

    const buttonText = this.add
      .text(x + buttonWidth / 2, y + buttonHeight / 2, 'End Game', {
        fontSize: '20px',
        color: '#fff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    this.endGameButton = this.add.container(x, y, [buttonBg, buttonText]);
    this.endGameButton.setDepth(6000);
    this.endGameButton.setSize(buttonWidth, buttonHeight);
    this.endGameButton.setInteractive({
      useHandCursor: true,
      hitArea: new Phaser.Geom.Rectangle(0, 0, buttonWidth, buttonHeight),
      hitAreaCallback: Phaser.Geom.Rectangle.Contains,
    });
    this.endGameButton.on('pointerdown', () => this.endGame());
  }

  // Dragging a card along the hand moves it to a new position; the other cards slide aside.
  setupHandDragging() {
    this.input.on('dragstart', (pointer, card) => {
      if (!this.hand.includes(card)) return;
      this.draggedCard = card;
      this.tweens.killTweensOf(card);
      card.setDepth(1000);
    });

    this.input.on('drag', (pointer, card, dragX, dragY) => {
      if (card !== this.draggedCard) return;
      card.setPosition(dragX, dragY);

      const oldIndex = this.hand.indexOf(card);
      const newIndex = this.handIndexForX(dragX);
      if (newIndex !== oldIndex) {
        this.hand.splice(oldIndex, 1);
        this.hand.splice(newIndex, 0, card);
        this.layoutHand(true);
      }
    });

    this.input.on('dragend', (pointer, card) => {
      if (card !== this.draggedCard) return;
      this.draggedCard = null;
      if (this.hand.includes(card)) {
        this.layoutHand(true);
      }
    });
  }

  setupPileDrops() {
    this.input.on('drop', (pointer, card, dropZone) => {
      if (!this.hand.includes(card) || this.gameEnded) return;

      const zoneType = dropZone.data.get('type');
      const isActionCard = ['swap', 'destroy', 'remove', 'clear'].includes(card.cardData.kind);

      if (this.turnActionUsed) {
        this.countText.setText('Action used this turn');
        this.layoutHand(true);
        return;
      }

      if (this.turnNumber >= maxTurns) {
        this.countText.setText('No actions after turn 10');
        this.layoutHand(true);
        return;
      }

      if (zoneType === 'action' && !isActionCard) {
        this.layoutHand(true);
        return;
      }

      this.hand = this.hand.filter((handCard) => handCard !== card);
      card.disableInteractive();

      if (zoneType === 'action') {
        this.actionPile.push(card);
        card.setDepth(100 + this.actionPile.length);
        card.setPosition(this.actionPileX + (this.actionPile.length - 1) * 2, this.actionPileY + (this.actionPile.length - 1) * 2);
      }

      if (zoneType === 'discard') {
        this.discardPile.push(card);
        card.setDepth(100 + this.discardPile.length);
        card.setPosition(this.discardPileX + (this.discardPile.length - 1) * 2, this.discardPileY + (this.discardPile.length - 1) * 2);
      }

      this.layoutHand(true);
      this.refreshPileZones();
      this.turnActionUsed = true;
      this.awaitingDraw = true;
      this.turnText.setText(`Turn ${this.turnNumber + 1}: Draw a card for next turn`);
    });
  }

  // Positions of each slot in the hand, shared by layout and drag logic.
  handSlots() {
    const count = this.hand.length;
    const availableWidth = this.scale.width - handMargin * 2 - cardWidth;
    const spacing = count > 1 ? Math.min(maxHandSpacing, availableWidth / (count - 1)) : 0;
    const startX = this.scale.width / 2 - ((count - 1) * spacing) / 2;
    const y = this.scale.height - cardHeight / 2 - 30;
    return { count, spacing, startX, y };
  }

  handIndexForX(x) {
    const { count, spacing, startX } = this.handSlots();
    if (count <= 1 || spacing === 0) return 0;
    const index = Math.round((x - startX) / spacing);
    return Phaser.Math.Clamp(index, 0, count - 1);
  }

  dealStartingHand() {
    while (this.hand.length < maxHandSize && this.deck.remaining > 0) {
      const cardData = this.deck.drawTop();
      if (!cardData) break;
      const card = new Card(this, 0, 0, cardData);
      card.showFace();
      this.hand.push(card);
    }
    this.layoutHand();
    this.refreshPile();
  }

  drawTopCard() {
    if (this.gameEnded) return;

    if (this.awaitingDraw) {
      this.turnNumber += 1;
      this.awaitingDraw = false;
      this.turnActionUsed = false;
      this.refreshTurnText();
    }

    if (this.hand.length >= maxHandSize) {
      this.countText.setText('Hand full');
      return;
    }

    const cardData = this.deck.drawTop();
    if (!cardData) return;

    const card = new Card(this, 0, 0, cardData);
    card.showFace();
    this.hand.push(card);

    this.layoutHand();
    this.refreshPile();

  }

  refreshTurnText() {
    if (this.turnNumber >= maxTurns) {
      this.turnText.setText(`Turn ${maxTurns}: Final Turn, create your sequence and end the game`);
      return;
    }

    this.turnText.setText(`Turn ${this.turnNumber + 1}: Your Turn`);
  }

  completeTurn() {
    this.layoutHand(true);
    this.refreshPile();
  }

  layoutHand(animate = false) {
    const { spacing, startX, y } = this.handSlots();

    this.hand.forEach((card, i) => {
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
    this.actionPileText.setText(`Action Pile: ${this.actionPile.length}`);
    this.discardPileText.setText(`Discard: ${this.discardPile.length}`);
    this.actionPileText.setDepth(5000);
    this.discardPileText.setDepth(5000);

    this.actionPileLayers.forEach((layer, i) => {
      layer.setVisible(i < Math.min(maxPileLayers, this.actionPile.length));
      layer.setDepth(10 + i);
    });

    this.discardPileLayers.forEach((layer, i) => {
      layer.setVisible(i < Math.min(maxPileLayers, this.discardPile.length));
      layer.setDepth(10 + i);
    });
  }

  endGame() {
    if (this.gameEnded) return;
    this.gameEnded = true;

    let total = 0;
    const handCards = [...this.hand];

    for (const card of handCards) {
      const kind = card.cardData.kind;
      if (!['add', 'subtract', 'multiply', 'amplify'].includes(kind)) continue;

      const value = Number(card.cardData.value) || 0;
      if (kind === 'add') total += value;
      if (kind === 'subtract') total += value;
      if (kind === 'multiply') total *= value;
      if (kind === 'amplify') total = Math.pow(total, value);
    }

    this.scoreText.setText(`Score: ${total}`);
    this.scoreText.setVisible(true);

    this.pileHitArea.disableInteractive();
    this.endGameButton.disableInteractive();
    this.input.enabled = false;
  }
}