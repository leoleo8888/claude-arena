import { test } from 'node:test'
import assert from 'node:assert/strict'
import { matchRoute } from './routes.js'

const table = [
  ['GET', '/state', 'state'],
  ['POST', '/event', 'event'],
  ['GET', '/chat/:session', 'chat'],
  ['POST', '/remote/:session', 'remote-post'],
  ['GET', '/remote/:session', 'remote-get'],
]

test('matchRoute finds exact paths, captures the session, and tells a wrong method from a wrong path', () => {
  assert.equal(matchRoute(table, 'GET', '/state').handler, 'state')
  assert.deepEqual(matchRoute(table, 'GET', '/chat/abc%2Fdef'), { handler: 'chat', params: { session: 'abc%2Fdef' } })
  assert.equal(matchRoute(table, 'POST', '/remote/x').handler, 'remote-post')
  assert.equal(matchRoute(table, 'GET', '/remote/x').handler, 'remote-get')
  assert.deepEqual(matchRoute(table, 'DELETE', '/state'), { methodMismatch: true })
  assert.equal(matchRoute(table, 'GET', '/chat/'), null)        // an empty session is no route
  assert.equal(matchRoute(table, 'GET', '/nope'), null)
  assert.equal(matchRoute(table, 'GET', '/stateful'), null)      // a prefix is not a match
})
