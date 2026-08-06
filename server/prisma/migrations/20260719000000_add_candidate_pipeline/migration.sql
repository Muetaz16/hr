-- CreateTable
CREATE TABLE "Candidate" (
    "id" TEXT NOT NULL,
    "requisitionId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "cvPath" TEXT,
    "stage" TEXT NOT NULL DEFAULT 'SCREENING',
    "screenDecision" TEXT,
    "screenNote" TEXT,
    "screenById" TEXT,
    "screenAt" TIMESTAMP(3),
    "interviewAt" TIMESTAMP(3),
    "interviewLocation" TEXT,
    "interviewNote" TEXT,
    "hrScore" INTEGER,
    "hrRecommend" BOOLEAN,
    "hrNote" TEXT,
    "hrEvalById" TEXT,
    "hrEvalAt" TIMESTAMP(3),
    "techScore" INTEGER,
    "techRecommend" BOOLEAN,
    "techNote" TEXT,
    "techEvalById" TEXT,
    "techEvalAt" TIMESTAMP(3),
    "finalDecision" TEXT,
    "finalNote" TEXT,
    "offerDecision" TEXT,
    "offerNote" TEXT,
    "offerAt" TIMESTAMP(3),
    "employeeId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Candidate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Candidate_requisitionId_idx" ON "Candidate"("requisitionId");

-- CreateIndex
CREATE INDEX "Candidate_stage_idx" ON "Candidate"("stage");

-- AddForeignKey
ALTER TABLE "Candidate" ADD CONSTRAINT "Candidate_requisitionId_fkey" FOREIGN KEY ("requisitionId") REFERENCES "RecruitmentRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Candidate" ADD CONSTRAINT "Candidate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Candidate" ADD CONSTRAINT "Candidate_screenById_fkey" FOREIGN KEY ("screenById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Candidate" ADD CONSTRAINT "Candidate_hrEvalById_fkey" FOREIGN KEY ("hrEvalById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Candidate" ADD CONSTRAINT "Candidate_techEvalById_fkey" FOREIGN KEY ("techEvalById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
