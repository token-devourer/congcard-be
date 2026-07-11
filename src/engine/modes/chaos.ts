import type { ActiveChaosSpecialValue, Card, CardValue, Color, GameMode, TurnContext } from "@congcard/shared";
import { ACTIVE_CHAOS_SPECIAL_VALUES, CHAOS_SPECIAL_VALUES, getChaosSpecialSpawnMode, getChaosSpecialSpawnPercent, LIGHT_COLORS } from "@congcard/shared";
import { shuffleCards } from "./standard.js";

const CHAOS_SPECIALS = ACTIVE_CHAOS_SPECIAL_VALUES;
const CHAOS_SPECIAL_COPIES_PER_BOX = 2;

function numberCards(color: Color, deckIndex: number): Card[] {
  const cards: Card[] = [{ id: `${deckIndex}-${color}-0-0`, color, value: 0, deckIndex }];

  for (let value = 1; value <= 9; value += 1) {
    cards.push({ id: `${deckIndex}-${color}-${value}-0`, color, value: value as CardValue, deckIndex });
    cards.push({ id: `${deckIndex}-${color}-${value}-1`, color, value: value as CardValue, deckIndex });
  }

  return cards;
}

function actionCards(color: Color, deckIndex: number): Card[] {
  return ["skip", "reverse", "draw1", "throwup"].flatMap((value) =>
    [0, 1].map((copy) => ({
      id: `${deckIndex}-${color}-${value}-${copy}`,
      color,
      value: value as CardValue,
      deckIndex
    }))
  );
}

function wildCards(deckIndex: number): Card[] {
  return ["wild", "wild2"].flatMap((value) =>
    [0, 1, 2, 3].map((copy) => ({
      id: `${deckIndex}-wild-${value}-${copy}`,
      color: null,
      value: value as CardValue,
      deckIndex
    }))
  );
}

function specialCards(deckIndex: number): Card[] {
  return CHAOS_SPECIALS.flatMap((value) =>
    Array.from({ length: CHAOS_SPECIAL_COPIES_PER_BOX }, (_, copy) => ({
      id: `${deckIndex}-special-${value}-${copy}`,
      color: null,
      value,
      deckIndex
    }))
  );
}

export function buildChaosDeckBox(deckIndex: number): Card[] {
  const cards: Card[] = [];

  for (const color of LIGHT_COLORS) {
    cards.push(...numberCards(color, deckIndex));
    cards.push(...actionCards(color, deckIndex));
  }

  cards.push(...wildCards(deckIndex));
  cards.push(...specialCards(deckIndex));
  return cards;
}

function isChaosSpecial(value: CardValue): value is ActiveChaosSpecialValue {
  return CHAOS_SPECIALS.includes(value as ActiveChaosSpecialValue);
}

function isPercentageSpecial(value: CardValue): boolean {
  return CHAOS_SPECIAL_VALUES.includes(value as (typeof CHAOS_SPECIAL_VALUES)[number]);
}

function replaceSpecialSlotsForPercentage(cards: Card[], percent: number): Card[] {
  const targetCount = Math.round(cards.length * percent / 100);
  const currentSpecialSlots = cards.filter((card) => isPercentageSpecial(card.value));
  const normalSlots = cards.filter((card) => !isPercentageSpecial(card.value));
  const next = [...cards];
  let serial = 0;

  for (let index = 0; index < Math.min(targetCount, currentSpecialSlots.length); index += 1) {
    const slot = currentSpecialSlots[index]!;
    const value = CHAOS_SPECIAL_VALUES[index % CHAOS_SPECIAL_VALUES.length]!;
    const replacement: Card = {
      id: `percentage-special-${serial}-${value}`,
      color: value === "throwup" ? LIGHT_COLORS[serial % LIGHT_COLORS.length]! : null,
      value,
      deckIndex: slot.deckIndex
    };
    serial += 1;
    const slotIndex = next.findIndex((card) => card.id === slot.id);
    next[slotIndex] = replacement;
  }

  if (targetCount < currentSpecialSlots.length) {
    for (let index = targetCount; index < currentSpecialSlots.length; index += 1) {
      const specialSlot = currentSpecialSlots[index]!;
      const source = normalSlots[index - targetCount]!;
      const replacement: Card = {
        ...source,
        id: `percentage-normal-${serial}-${source.id}`,
        deckIndex: specialSlot.deckIndex
      };
      serial += 1;
      const slotIndex = next.findIndex((card) => card.id === specialSlot.id);
      next[slotIndex] = replacement;
    }
    return next;
  }

  for (let index = currentSpecialSlots.length; index < targetCount; index += 1) {
    const normalSlot = normalSlots[index - currentSpecialSlots.length]!;
    const value = CHAOS_SPECIAL_VALUES[index % CHAOS_SPECIAL_VALUES.length]!;
    const replacement: Card = {
      id: `percentage-special-${serial}-${value}`,
      color: value === "throwup" ? LIGHT_COLORS[serial % LIGHT_COLORS.length]! : null,
      value,
      deckIndex: normalSlot.deckIndex
    };
    serial += 1;
    const slotIndex = next.findIndex((card) => card.id === normalSlot.id);
    next[slotIndex] = replacement;
  }

  return next;
}

function isPlayable(card: Card, ctx: TurnContext): boolean {
  if (card.color === null) {
    return card.value === "wild" || card.value === "wild2" || isChaosSpecial(card.value);
  }

  if (ctx.discardTop.color === null && isChaosSpecial(ctx.discardTop.value)) {
    return true;
  }

  return card.color === ctx.activeColor || card.value === ctx.discardTop.value;
}

export const chaosMode: GameMode = {
  id: "chaos",
  initialHandSize: 10,
  buildDeck(_playerCount, deckBoxes, modeOptions) {
    const cards: Card[] = [];
    for (let deckIndex = 0; deckIndex < (deckBoxes ?? 1); deckIndex += 1) {
      cards.push(...buildChaosDeckBox(deckIndex));
    }
    if (getChaosSpecialSpawnMode(modeOptions) === "percentage") {
      return shuffleCards(replaceSpecialSlotsForPercentage(cards, getChaosSpecialSpawnPercent(modeOptions)));
    }
    return shuffleCards(cards);
  },
  isPlayable,
  scoreHand(hand) {
    return hand.reduce((score, card) => {
      if (typeof card.value === "number") return score + card.value;
      if (card.value === "wild" || card.value === "wild2" || isChaosSpecial(card.value)) return score + 50;
      return score + 20;
    }, 0);
  },
  allowedOutOfTurnActions() {
    return ["catchOne", "challenge"];
  }
};

export function isChaosSpecialValue(value: CardValue): boolean {
  return isChaosSpecial(value);
}
