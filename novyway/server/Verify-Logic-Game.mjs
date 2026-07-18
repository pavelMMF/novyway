import assert from 'node:assert/strict'
import { logicChallenges, presentLogicChallenge, scoreLogicAnswer } from './lib/logic-game.mjs'

assert.equal(logicChallenges.length, 150, 'The catalog must contain 150 challenges')
assert.equal(new Set(logicChallenges.map((challenge) => challenge.id)).size, 150, 'Challenge IDs must be unique')
assert.equal(new Set(logicChallenges.map((challenge) => challenge.family)).size, 15, 'The catalog must cover 15 fallacy families')

for (const challenge of logicChallenges) {
  assert.match(challenge.id, /^logic-\d{3}-v1$/)
  assert.ok([1, 2, 3].includes(challenge.difficulty), `${challenge.id}: invalid difficulty`)
  for (const lang of ['ru', 'en']) {
    const segments = challenge.segments[lang]
    assert.equal(segments.length, 3, `${challenge.id}/${lang}: expected three selectable segments`)
    assert.ok(segments.every((segment) => typeof segment === 'string' && segment.trim().length >= 20))
    const publicChallenge = presentLogicChallenge(challenge, lang)
    assert.equal(Object.hasOwn(publicChallenge, 'correctIndex'), false, `${challenge.id}: answer leaked`)
    assert.equal(Object.hasOwn(publicChallenge, 'explanation'), false, `${challenge.id}: explanation leaked`)
    assert.equal(scoreLogicAnswer(challenge, challenge.correctIndex, lang).points, challenge.difficulty * 10)
    assert.equal(scoreLogicAnswer(challenge, (challenge.correctIndex + 1) % segments.length, lang).points, 0)
  }
}

for (const lang of ['ru', 'en']) {
  const texts = logicChallenges.map((challenge) => challenge.segments[lang].join('\n'))
  assert.equal(new Set(texts).size, texts.length, `Duplicate ${lang} challenges found`)
}

console.log(JSON.stringify({
  challenges: logicChallenges.length,
  families: new Set(logicChallenges.map((challenge) => challenge.family)).size,
  answersHiddenUntilSubmission: true,
  scoreValidated: true,
}, null, 2))
