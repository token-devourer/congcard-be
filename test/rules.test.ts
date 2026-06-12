import { describe, expect, it } from "vitest";
import type { Card } from "@congkak-game/shared";
import { standardMode } from "../src/engine/modes/standard.js";
import {
  addPlayer,
  callOne,
  catchOne,
  createGame,
  drawCard,
  playCard,
  resolveChallenge,
  setReady,
  snapshotFor,
  startRound,
  type GameStateInternal
} from "../src/engine/game.js";

function card(id: string, color: Card["color"], value: Card["value"]): Card {
  return { id, color, value, deckIndex: 0 };
}

function drawPile(count = 40): Card[] {
  return Array.from({ length: count }, (_, index) => card(`draw-${index}`, "blue", (index % 10) as Card["value"]));
}

function controlledGame(): GameStateInternal {
  const state = createGame("ABC123", { turnTimeoutSec: 30 });
  addPlayer(state, "p1", "Ava", "sun");
  addPlayer(state, "p2", "Ben", "moon");
  state.phase = "playing";
  state.activeColor = "red";
  state.discardPile = [card("discard-red-5", "red", 5)];
  state.drawPile = drawPile();
  state.currentSeat = 0;
  state.direction = 1;
  state.players[0]!.hand = [];
  state.players[1]!.hand = [];
  return state;
}

describe("standard mode", () => {
  it("builds a 108 card deck for standard player counts", () => {
    const deck = standardMode.buildDeck(10);
    const wilds = deck.filter((item) => item.color === null);

    expect(deck).toHaveLength(108);
    expect(wilds).toHaveLength(8);
    expect(deck.filter((item) => item.color === "red" && item.value === 0)).toHaveLength(1);
    expect(deck.filter((item) => item.color === "red" && item.value === 9)).toHaveLength(2);
    expect(deck.filter((item) => item.color === "red" && item.value === "skip")).toHaveLength(2);
  });

  it("validates playable cards by color, value, and wild status", () => {
    const ctx = {
      playerId: "p1",
      activeColor: "red" as const,
      discardTop: card("top", "green", 7),
      hand: [],
      playerCount: 3
    };

    expect(standardMode.isPlayable(card("red-1", "red", 1), ctx)).toBe(true);
    expect(standardMode.isPlayable(card("blue-7", "blue", 7), ctx)).toBe(true);
    expect(standardMode.isPlayable(card("wild", null, "wild"), ctx)).toBe(true);
    expect(standardMode.isPlayable(card("blue-2", "blue", 2), ctx)).toBe(false);
  });

  it("treats reverse as skip with two players", () => {
    const state = controlledGame();
    state.players[0]!.hand = [card("reverse", "red", "reverse"), card("blue-2", "blue", 2)];

    playCard(state, "p1", "reverse");

    expect(snapshotFor(state).currentPlayerId).toBe("p1");
    expect(state.direction).toBe(-1);
  });

  it("handles Wild Draw Four challenge success", () => {
    const state = controlledGame();
    state.players[0]!.hand = [card("wild4", null, "wild4"), card("red-9", "red", 9)];

    playCard(state, "p1", "wild4", "blue");
    expect(state.pendingChallenge?.guilty).toBe(true);

    resolveChallenge(state, "p2", true);

    expect(state.players[0]!.hand).toHaveLength(5);
    expect(snapshotFor(state).currentPlayerId).toBe("p2");
  });

  it("penalizes missed One calls", () => {
    const state = controlledGame();
    state.players[0]!.hand = [card("red-1", "red", 1), card("blue-2", "blue", 2)];

    playCard(state, "p1", "red-1");
    expect(state.oneWindow?.playerId).toBe("p1");

    catchOne(state, "p2", "p1");

    expect(state.players[0]!.hand).toHaveLength(3);
    expect(state.oneWindow).toBeUndefined();
  });

  it("allows a valid One call", () => {
    const state = controlledGame();
    state.players[0]!.hand = [card("red-1", "red", 1), card("blue-2", "blue", 2)];

    playCard(state, "p1", "red-1");
    callOne(state, "p1");

    expect(state.players[0]!.calledOne).toBe(true);
    expect(state.oneWindow).toBeUndefined();
  });

  it("reshuffles discard cards into the draw pile", () => {
    const state = controlledGame();
    state.players[0]!.hand = [card("green-9", "green", 9)];
    state.drawPile = [];
    state.discardPile = [card("old-1", "yellow", 3), card("old-2", "blue", 4), card("top", "red", 5)];

    drawCard(state, "p1");

    expect(state.discardPile).toHaveLength(1);
    expect(state.discardPile[0]!.id).toBe("top");
  });

  it("scores a finished round", () => {
    const state = controlledGame();
    state.players[0]!.hand = [card("red-1", "red", 1)];
    state.players[1]!.hand = [card("skip", "green", "skip"), card("wild", null, "wild")];
    state.players[1]!.cardCount = 2;

    playCard(state, "p1", "red-1");

    expect(state.phase).toBe("roundEnd");
    expect(state.players[0]!.score).toBe(70);
    expect(state.roundWinnerId).toBe("p1");
  });

  it("starts a round from lobby with ready players", () => {
    const state = createGame("ABC123");
    addPlayer(state, "p1", "Ava", "sun");
    addPlayer(state, "p2", "Ben", "moon");
    setReady(state, "p2", true);

    startRound(state);

    expect(state.phase).toBe("playing");
    expect(state.players[0]!.hand).toHaveLength(7);
    expect(state.players[1]!.hand).toHaveLength(7);
    expect(state.discardPile).toHaveLength(1);
  });
});
