import * as Phaser from 'phaser';

export const cardWidth = 100;
export const cardHeight = 140;

const backColor = 0x3355aa;
const faceColor = 0xffffff;
const borderColor = 0x222222;

export class Card extends Phaser.GameObjects.Container {
  constructor(scene, x, y, cardData) {
    const back = scene.add
      .rectangle(0, 0, cardWidth, cardHeight, backColor)
      .setStrokeStyle(2, faceColor);

    const faceBg = scene.add
      .rectangle(0, 0, cardWidth, cardHeight, faceColor)
      .setStrokeStyle(2, borderColor);
    const faceLabel = scene.add
      .text(0, 0, cardData.name, {
        color: '#000',
        fontSize: '18px',
        align: 'center',
        wordWrap: { width: cardWidth - 12 },
      })
      .setOrigin(0.5);
    const face = scene.add.container(0, 0, [faceBg, faceLabel]).setVisible(false);

    super(scene, x, y, [back, face]);

    this.cardData = cardData;
    this.back = back;
    this.face = face;
    this.faceUp = false;

    this.setSize(cardWidth, cardHeight);
    scene.add.existing(this);
  }

  showFace() {
    this.faceUp = true;
    this.back.setVisible(false);
    this.face.setVisible(true);
  }
}