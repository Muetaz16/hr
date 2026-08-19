-- CreateTable
CREATE TABLE "EvaluationFinalization" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "finalScore" DOUBLE PRECISION NOT NULL,
    "finalizedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finalizedById" TEXT,
    "isAuto" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "EvaluationFinalization_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EvaluationFinalization_employeeId_month_key" ON "EvaluationFinalization"("employeeId", "month");

-- AddForeignKey
ALTER TABLE "EvaluationFinalization" ADD CONSTRAINT "EvaluationFinalization_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluationFinalization" ADD CONSTRAINT "EvaluationFinalization_finalizedById_fkey" FOREIGN KEY ("finalizedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
