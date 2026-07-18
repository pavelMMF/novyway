import assert from 'node:assert/strict'
import { randomBytes, randomUUID } from 'node:crypto'
import {
  closeStorage,
  getLogicGameProfile,
  initializeStorage,
  listLogicGameAnsweredIds,
  pool,
  recordLogicGameAnswer,
} from './lib/storage.mjs'

const userId = randomUUID()
const address = `0x${randomBytes(32).toString('hex')}`

try {
  await initializeStorage()
  await pool.query(`INSERT INTO users
    (id, aptos_address, provider, role, status, wallet_kind, created_at, last_login_at)
    VALUES ($1, $2, 'wallet', 'voter', 'active', 'external', NOW(), NOW())`, [userId, address])

  const duplicate = await Promise.all([
    recordLogicGameAnswer({ userId, challengeId: 'logic-001-v1', selectedIndex: 1, correct: true, points: 20 }),
    recordLogicGameAnswer({ userId, challengeId: 'logic-001-v1', selectedIndex: 0, correct: false, points: 0 }),
  ])
  assert.equal(duplicate.filter((result) => result.recorded).length, 1, 'Concurrent duplicate must score once')

  const afterDuplicate = await getLogicGameProfile(userId)
  assert.deepEqual(afterDuplicate, {
    score: 20,
    answeredCount: 1,
    correctCount: 1,
    currentStreak: 1,
    bestStreak: 1,
  })

  const second = await recordLogicGameAnswer({
    userId,
    challengeId: 'logic-002-v1',
    selectedIndex: 0,
    correct: false,
    points: 0,
  })
  assert.equal(second.recorded, true)
  assert.deepEqual(second.profile, {
    score: 20,
    answeredCount: 2,
    correctCount: 1,
    currentStreak: 0,
    bestStreak: 1,
  })

  assert.deepEqual(new Set(await listLogicGameAnsweredIds(userId)), new Set(['logic-001-v1', 'logic-002-v1']))
  console.log(JSON.stringify({
    persistedPerUserScore: true,
    concurrentDuplicateScoredOnce: true,
    streakResetValidated: true,
    cleanup: 'temporary user removed',
  }, null, 2))
} finally {
  await pool.query('DELETE FROM users WHERE id = $1', [userId]).catch(() => {})
  await closeStorage()
}
