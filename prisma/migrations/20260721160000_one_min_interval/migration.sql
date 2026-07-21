-- Allow Business plan 1-minute monitoring cadence
ALTER TYPE "MonitoringInterval" ADD VALUE IF NOT EXISTS 'ONE_MIN';
