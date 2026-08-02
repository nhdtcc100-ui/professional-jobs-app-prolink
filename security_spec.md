# Security Specification for ProLink

## 1. Data Invariants
- **User Integrity**: A user document must be owned by the user whose UID matches the document ID.
- **Role Authority**: Only users with the `employer` role can create `jobs`.
- **Content Ownership**: Only the original author can modify or delete their `posts` or `jobs`.
- **Messaging Privacy**: Messages are strictly private. Only the `senderId` or `receiverId` can read a message. Messages are immutable once sent.
- **Relational Integrity**: `jobs` and `posts` must reference existing and valid user UIDs as authors/employers.

## 2. The Dirty Dozen (Vulnerability Test Payloads)

| # | Attack Vector | Target Path | Payload / Action | Expected Result |
|---|---|---|---|---|
| 1 | Identity Spoofing | `/users/victim_123` | `create` as `attacker_456` | `PERMISSION_DENIED` |
| 2 | Privilege Escalation | `/users/me` | `update` field `{ role: 'employer' }` (if already seeker) | `PERMISSION_DENIED` |
| 3 | Shadow Admin | `/users/me` | `update` field `{ isAdmin: true }` | `PERMISSION_DENIED` |
| 4 | Orphaned Job | `/jobs/job_1` | `create` with `{ employerId: 'victim_789' }` | `PERMISSION_DENIED` |
| 5 | Unauthorized Edit | `/posts/post_1` | `update` content by non-author | `PERMISSION_DENIED` |
| 6 | Resource Exhaustion | `/posts/post_1` | `create` with `content.size() > 5000` | `PERMISSION_DENIED` |
| 7 | ID Poisoning | `/users/!!--junk--!!` | `get` or `create` | `PERMISSION_DENIED` |
| 8 | Eavesdropping | `/messages/msg_1` | `get` message where user is neither sender nor receiver | `PERMISSION_DENIED` |
| 9 | Impersonation Write | `/messages/msg_1` | `create` message with `senderId: 'victim_123'` | `PERMISSION_DENIED` |
| 10 | Message Tampering | `/messages/msg_1` | `update` content of existing message | `PERMISSION_DENIED` |
| 11 | Bulk Scrape | `/users` | `list` all users (leaking PII) without verified email | `PERMISSION_DENIED` |
| 12 | Outcome Manipulation | `/posts/post_1` | `update` `likesCount` by injecting a string or massive negative number | `PERMISSION_DENIED` |

## 3. Test Runner (Draft)

```typescript
// firestore.rules.test.ts
// This file verifies the eight pillars of security for ProLink.

test('PII Isolation: Non-owner cannot read private fields of other users', async () => {
  const db = getFirestore(attackerAuth);
  await assertFails(getDoc(doc(db, 'users/victimUID')));
});

test('Messaging Guard: User cannot read messages they are not part of', async () => {
  const db = getFirestore(userAuth);
  await assertFails(getDoc(doc(db, 'messages/privateMsgId')));
});

test('Role Guard: Seekers cannot post jobs', async () => {
  const db = getFirestore(seekerAuth);
  await assertFails(addDoc(collection(db, 'jobs'), { ...validJob }));
});
```
