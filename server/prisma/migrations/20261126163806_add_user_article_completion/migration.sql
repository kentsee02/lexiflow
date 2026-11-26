-- CreateTable
CREATE TABLE "UserArticleCompletion" (
    "userId" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserArticleCompletion_pkey" PRIMARY KEY ("userId","articleId")
);

-- CreateIndex
CREATE INDEX "UserArticleCompletion_userId_idx" ON "UserArticleCompletion"("userId");

-- AddForeignKey
ALTER TABLE "UserArticleCompletion" ADD CONSTRAINT "UserArticleCompletion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserArticleCompletion" ADD CONSTRAINT "UserArticleCompletion_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;
