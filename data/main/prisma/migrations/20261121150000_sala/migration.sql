-- CreateTable
CREATE TABLE "seats" (
    "cast_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "claimed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_beat_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "seats_pkey" PRIMARY KEY ("cast_id")
);

-- CreateTable
CREATE TABLE "room_events" (
    "seq" SERIAL NOT NULL,
    "epoch" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "refs" JSONB NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "room_events_pkey" PRIMARY KEY ("seq")
);

-- CreateTable
CREATE TABLE "bot_tasks" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "cast_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "due_at" TIMESTAMP(3) NOT NULL,
    "done_at" TIMESTAMP(3),
    "result" TEXT,

    CONSTRAINT "bot_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "room_state" (
    "id" INTEGER NOT NULL,
    "epoch" INTEGER NOT NULL DEFAULT 1,
    "autoplay" BOOLEAN NOT NULL DEFAULT false,
    "speed" INTEGER NOT NULL DEFAULT 1,
    "active_scene" TEXT,
    "pause_until" TIMESTAMP(3),

    CONSTRAINT "room_state_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "room_events_epoch_idx" ON "room_events"("epoch");

-- CreateIndex
CREATE UNIQUE INDEX "bot_tasks_key_key" ON "bot_tasks"("key");

-- CreateIndex
CREATE INDEX "bot_tasks_done_at_due_at_idx" ON "bot_tasks"("done_at", "due_at");

