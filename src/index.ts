import { randomInt } from "node:crypto";
import cors from "cors";
import express from "express";
import pino from "pino";
import { matchMaker, Server } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { createRoomRequestSchema, mergeRoomSettings } from "@congkak-game/shared";
import { config } from "./config.js";
import { GameRoom } from "./rooms/GameRoom.js";
import { activeRoomCount, hasRoomCode, registerRoomCode, resolveRoomCode } from "./rooms/directory.js";

const logger = pino({ level: config.logLevel });
const gameServer = new Server({
  transport: new WebSocketTransport(),
  express: (app) => {
    configureHttp(app);
  }
});

gameServer.define("game", GameRoom);

function configureHttp(app: express.Application): void {
  app.use(express.json());
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || config.corsOrigins.includes(origin) || config.corsOrigins.includes("*")) {
          callback(null, true);
          return;
        }

        callback(new Error("Origin is not allowed."));
      }
    })
  );

  app.get("/healthz", (_request, response) => {
    response.json({
      ok: true,
      rooms: activeRoomCount()
    });
  });

  app.post("/rooms", async (request, response) => {
    try {
      if (activeRoomCount() >= config.maxRooms) {
        response.status(503).json({ code: "room_limit", message: "The server is at room capacity." });
        return;
      }

      const payload = createRoomRequestSchema.parse(request.body ?? {});
      const settings = mergeRoomSettings({
        turnTimeoutSec: config.turnTimeoutDefault,
        ...payload.settings
      });
      const code = generateRoomCode();
      const room = await matchMaker.createRoom("game", { code, settings });
      registerRoomCode(code, room.roomId);

      response.status(201).json({
        code,
        roomId: room.roomId
      });
    } catch (error) {
      logger.error({ error }, "room_create_failed");
      response.status(400).json({ code: "room_create_failed", message: "Room could not be created." });
    }
  });

  app.get("/rooms/:code", (request, response) => {
    const code = request.params.code?.toUpperCase() ?? "";
    const roomId = resolveRoomCode(code);

    if (!roomId) {
      response.status(404).json({ code: "room_not_found", message: "Room was not found." });
      return;
    }

    response.json({ code, roomId });
  });
}

await gameServer.listen(config.port, undefined, undefined, () => {
  logger.info({ port: config.port }, "congkak_game_server_ready");
});

function generateRoomCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

  for (let attempt = 0; attempt < 20; attempt += 1) {
    let code = "";
    for (let index = 0; index < 6; index += 1) {
      code += alphabet[randomInt(alphabet.length)];
    }

    if (!hasRoomCode(code)) {
      return code;
    }
  }

  throw new Error("Could not generate a unique room code.");
}

async function shutdown(): Promise<void> {
  logger.info("shutting_down");
  await gameServer.gracefullyShutdown(false);
}

process.on("SIGINT", () => {
  void shutdown().then(() => process.exit(0));
});

process.on("SIGTERM", () => {
  void shutdown().then(() => process.exit(0));
});
