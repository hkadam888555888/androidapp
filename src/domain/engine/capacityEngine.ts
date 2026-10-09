import type { CapacityPolicy, CapacityResult } from '../entities/models';

export function calculateCapacity(policy: CapacityPolicy, availableMinutes: number): CapacityResult {
  const rawStudyMinutes = Math.max(0, Math.min(policy.maxStudyMinutes, Math.floor(availableMinutes)));
  const bufferFraction = Math.max(0, Math.min(0.9, policy.bufferPercentage / 100));
  const bufferedStudyMinutes = Math.floor(rawStudyMinutes * (1 - bufferFraction));
  const effectiveStudyMinutes = Math.min(bufferedStudyMinutes, Math.max(0, policy.maxCognitiveMinutes));
  return {
    rawStudyMinutes,
    bufferedStudyMinutes,
    effectiveStudyMinutes,
    maxCognitiveMinutes: Math.max(0, policy.maxCognitiveMinutes),
    maxDeepWorkSessions: Math.max(0, Math.floor(policy.maxDeepWorkSessions)),
    maxContinuousFocusMinutes: Math.max(1, Math.floor(policy.maxContinuousFocusMinutes)),
  };
}
