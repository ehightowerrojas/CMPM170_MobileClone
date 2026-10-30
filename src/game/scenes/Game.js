import * as Phaser from 'phaser';
import { Deck, buildDeck, deckSize } from '../logic/Deck';
import { Card, cardWidth, cardHeight } from '../objects/Card';

const maxHandSpacing = 110;
const handMargin = 40;
const handGap = 40; // empty space between the two hands at screen center
const maxPileLayers = 5;
const pileLayerOffset = 2;

export class Game extends Phaser.Scene {
  constructor() {
    super('Game');
  }

  create() {
    this.cameras.main.setBackgroundColor('#01b76b');
    this.deck = new Deck(buildDeck(deckSize));

    // Two separate hands; which one receives a card depends on the turn.
    this.hands = { left: [], right: [] };

    this.pileX = this.scale.width / 2;
    this.pileY = this.scale.height / 2 - 80;

    // A few stacked rectangles give the pile some visual thickness.
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

    // One invisible zone handles clicks for the whole pile.
    this.pileHitArea = this.add
      .zone(this.pileX, this.pileY, cardWidth + 10, cardHeight + 10)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.drawTopCard());

    this.countText = this.add
      .text(this.pileX, this.pileY + cardHeight / 2 + 24, '', { fontSize: '20px', color: '#fff' })
      .setOrigin(0.5);

    this.refreshPile();

    // Turn counter
    this.turn = 1;
    this.turnCounterButton = this.add
      .text(50, 50, '', { fontSize: '20px', color: '#fff' })
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.newTurn());
    this.updateTurnText();
  }

  newTurn() {
    this.turn += 1;
    this.updateTurnText();
  }

  updateTurnText() {
    const side = this.handSideForTurn(this.turn);
    this.turnCounterButton.setText(`Turn: ${this.turn} (draws ${side})`);
  }

  // Change this rule to control which side each turn draws to.
  // Currently: odd turns -> left, even turns -> right.
  handSideForTurn(turn) {
    return turn % 2 === 1 ? 'left' : 'right';
  }

  drawTopCard() {
    const cardData = this.deck.drawTop();
    if (!cardData) return;

    const side = this.handSideForTurn(this.turn);
    const card = new Card(this, 0, 0, cardData);
    card.showFace();
    this.hands[side].push(card);

    this.layoutHand(side);
    this.refreshPile();
  }

  // Lays out one hand inside its half of the screen (left or right of center).
  layoutHand(side) {
    const hand = this.hands[side];
    const count = hand.length;
    const halfWidth = this.scale.width / 2;

    const regionLeft = side === 'left' ? handMargin : halfWidth + handGap / 2;
    const regionRight = side === 'left' ? halfWidth - handGap / 2 : this.scale.width - handMargin;

    const availableWidth = Math.max(0, regionRight - regionLeft - cardWidth);
    const spacing = count > 1 ? Math.min(maxHandSpacing, availableWidth / (count - 1)) : 0;
    const regionCenterX = (regionLeft + regionRight) / 2;
    const startX = regionCenterX - ((count - 1) * spacing) / 2;
    const handY = this.scale.height - cardHeight / 2 - 30;

    hand.forEach((card, i) => {
      card.setDepth(i + 1);
      card.setPosition(startX + i * spacing, handY);
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
}