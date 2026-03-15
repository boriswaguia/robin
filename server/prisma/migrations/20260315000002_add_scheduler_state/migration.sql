-- Tracks the last successful run time for each named scheduled job.
-- Used to detect missed runs after a server restart.
CREATE TABLE "SchedulerState" (
    "jobName"   TEXT NOT NULL,
    "lastRunAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchedulerState_pkey" PRIMARY KEY ("jobName")
);
