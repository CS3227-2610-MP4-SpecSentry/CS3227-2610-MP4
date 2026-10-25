CREATE TYPE "AccountRole" AS ENUM ('CONTRIBUTOR', 'REVIEWER', 'RELEASE_MAINTAINER');

CREATE TABLE "UserAccount" (
  "id" TEXT NOT NULL,
  "username" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "role" "AccountRole" NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "version" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "UserAccount_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "UserAccount_version_positive" CHECK ("version" > 0),
  CONSTRAINT "UserAccount_username_normalized" CHECK ("username" ~ '^[a-z0-9._-]{1,80}$')
);
CREATE UNIQUE INDEX "UserAccount_username_key" ON "UserAccount"("username");

CREATE TABLE "AuthSession" (
  "id" TEXT NOT NULL,
  "data" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AuthSession_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AuthSession_expiresAt_idx" ON "AuthSession"("expiresAt");

CREATE TABLE "LoginThrottle" (
  "key" TEXT NOT NULL,
  "failuresAt" TIMESTAMP(3)[] NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "blockedUntil" TIMESTAMP(3),
  CONSTRAINT "LoginThrottle_pkey" PRIMARY KEY ("key")
);

CREATE TABLE "SecurityEvent" (
  "id" TEXT NOT NULL,
  "actorId" TEXT,
  "action" TEXT NOT NULL,
  "target" TEXT NOT NULL,
  "outcome" TEXT NOT NULL,
  "correlationId" TEXT,
  "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SecurityEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SecurityEvent_timestamp_idx" ON "SecurityEvent"("timestamp");
