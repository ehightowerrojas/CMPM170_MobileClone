export const deckSize = 60;

export class Deck {
  constructor(cards) {
    this.cards = [...cards];
    this.shuffle();
  }

  shuffle() {
    for (let i = this.cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
    }
  }

  drawTop() {
    return this.cards.pop();
  }

  get remaining() {
    return this.cards.length;
  }
}

export function buildDeck(size = deckSize) {
  return Array.from({ length: size }, (_, i) => ({
    id: i + 1,
    name: `Card ${i + 1}`,
  }));
}
