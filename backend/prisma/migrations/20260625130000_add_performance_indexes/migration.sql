-- Tool: Besitz- und Filterabfragen (ownerId / status / category)
CREATE INDEX "Tool_ownerId_idx" ON "Tool"("ownerId");
CREATE INDEX "Tool_status_idx" ON "Tool"("status");
CREATE INDEX "Tool_category_idx" ON "Tool"("category");

-- Notification: listByUser (userId-Filter + createdAt-Sortierung)
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- RefreshToken: Aufräumen abgelaufener Tokens
CREATE INDEX "RefreshToken_expiresAt_idx" ON "RefreshToken"("expiresAt");
