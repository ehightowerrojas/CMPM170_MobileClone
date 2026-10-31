import * as Phaser from 'phaser';
import { Deck, buildDeck, deckSize } from '../logic/Deck';
import { Card, cardWidth, cardHeight } from '../objects/Card';

const maxHandSpacing = 110;
const handMargin = 40;
const maxPileLayers = 5;
const pileLayerOffset = 2;

export class Game extends Phaser.Scene {
  constructor() {
    super('Game');
  }

  create() {
    this.cameras.main.setBackgroundColor('#01b76b');
    this.deck = new Deck(buildDeck(deckSize));
    this.hand = [];

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

    this.draggedCard = null;
    this.setupHandDragging();

    this.refreshPile();
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
      this.layoutHand(true);
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

  drawTopCard() {
    const cardData = this.deck.drawTop();
    if (!cardData) return;

    const card = new Card(this, 0, 0, cardData);
    card.showFace();
    this.hand.push(card);

    this.layoutHand();
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
}