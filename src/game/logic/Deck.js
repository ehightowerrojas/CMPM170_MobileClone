export const deckSize = 54;

function buildCard(kind, value, label, description = '') {
  return {
    id: 0,
    kind,
    value,
    label,
    name: label,
    description,
    symbol: kind === 'add' ? '+' : kind === 'subtract' ? '−' : kind === 'multiply' ? '×' : kind === 'amplify' ? '^' : '',
  };
}

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
  const cards = [];

  for (let value = 1; value <= 5; value++) {
    for (let i = 0; i < 4; i++) {
      cards.push(buildCard('add', value, `Stable DNA +${value}`));
    }
  }

  for (let value = 1; value <= 4; value++) {
    for (let i = 0; i < 2; i++) {
      cards.push(buildCard('subtract', -value, `Unstable DNA -${value}`));
    }
  }

  for (const value of [2, 3]) {
    for (let i = 0; i < 4; i++) {
      cards.push(buildCard('multiply', value, `DNA Replication x${value}`));
    }
  }

  for (const value of [2, 3]) {
    for (let i = 0; i < 3; i++) {
      cards.push(buildCard('amplify', value, `DNA Amplification ^${value}`));
    }
  }

  for (let i = 0; i < 4; i++) {
    cards.push(buildCard('swap', 0, 'DNA Exchange', 'Choose one opponent card and exchange it for one of yours'));
  }

  for (let i = 0; i < 4; i++) {
    cards.push(buildCard('remove', 0, 'Sample Destruction', 'Placeholder for future multiplayer remove effect'));
  }

  for (let i = 0; i < 4; i++) {
    cards.push(buildCard('clear', 0, 'Lab Reset', 'Resets your hand and redraws it'));
  }

  const deck = new Deck(cards.slice(0, size));
  return deck.cards;
}
