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

    this.refreshPile();

    //turn counter
    this.turn = 1;
    this.turnCounterButton = this.add
      .text(50, 50, 'Turn: ' + this.turn, { fontSize: '20px', color: '#fff' })
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.newTurn());
  }

  newTurn() {
    this.turn += 1;
    this.turnCounterButton.setText('Turn: ' + this.turn);
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

  layoutHand() {
    const count = this.hand.length;
    const availableWidth = this.scale.width - handMargin * 2 - cardWidth;
    const spacing = count > 1 ? Math.min(maxHandSpacing, availableWidth / (count - 1)) : 0;
    const startX = this.scale.width / 2 - ((count - 1) * spacing) / 2;
    const handY = this.scale.height - cardHeight / 2 - 30;

    this.hand.forEach((card, i) => {
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