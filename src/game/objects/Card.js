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
    const cardText = cardData.label || cardData.name || 'Card';
    const arithmeticMatch = cardText.match(/(Stable DNA|Unstable DNA|DNA Replication|DNA Amplification)\s+([+\-x^]\d+)/);

    let faceLabel;
    if (arithmeticMatch) {
      const [, prefix, arithmetic] = arithmeticMatch;
      const prefixText = scene.add.text(0, -8, prefix, {
        color: '#000',
        fontSize: '12px',
        align: 'center',
        wordWrap: { width: cardWidth - 12 },
      }).setOrigin(0.5);
      const arithmeticText = scene.add.text(0, 12, arithmetic, {
        color: '#000',
        fontSize: '18px',
        fontStyle: 'bold',
        align: 'center',
      }).setOrigin(0.5);
      faceLabel = scene.add.container(0, 0, [prefixText, arithmeticText]);
    } else {
      faceLabel = scene.add
        .text(0, 0, cardText, {
          color: '#000',
          fontSize: '15px',
          align: 'center',
          wordWrap: { width: cardWidth - 12 },
        })
        .setOrigin(0.5);
    }

    const face = scene.add.container(0, 0, [faceBg, faceLabel]).setVisible(false);

    super(scene, x, y, [back, face]);

    this.cardData = cardData;
    this.back = back;
    this.face = face;
    this.faceUp = false;

    this.setSize(cardWidth, cardHeight);
    scene.add.existing(this);

    // Let the player pick the card up and drag it around.
    this.setInteractive({ useHandCursor: true, draggable: true });
  }

  showFace() {
    this.faceUp = true;
    this.back.setVisible(false);
    this.face.setVisible(true);
  }
}