-- AlterTable
ALTER TABLE "room_state" DROP COLUMN "active_scene",
DROP COLUMN "autoplay",
DROP COLUMN "pause_until",
DROP COLUMN "speed";

-- DropTable
DROP TABLE "bot_tasks";

