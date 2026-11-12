# Ledgerly: Learning Guide

![CWE-639](https://img.shields.io/badge/CWE--639-IDOR-red?style=flat-square)
![Node](https://img.shields.io/badge/Node-Express-blue?style=flat-square&logo=node.js&logoColor=white)
![Docker](https://img.shields.io/badge/Lab-Docker-2496ED?style=flat-square&logo=docker&logoColor=white)

**Ledgerly is an intentionally vulnerable application built for security education.** It contains a deliberate [IDOR / broken access control](https://owasp.org/Top10/A01_2021-Broken_Access_Control/)
(CWE-639) flaw so you can practice finding and exploiting it in a safe and controlled environment.

<br>

> [!TIP]
> A guided, **non-spoiler** path to solving this lab. It teaches the *method*, not the answer — the exact winning request and the flag stay in [SOLUTION.md](SOLUTION.md).

<br>

## 🧬 What broken access control is

Here is the whole idea in one sentence:

> **Broken access control happens when an app checks _who you are_ but forgets
> to check _whether you're allowed to touch this particular thing_.**

Logging in answers "who are you?" — that's **authentication**. Deciding whether
*this* user may read *this* invoice is a separate question — that's
**authorization**. The classic mistake, and the one in this lab, is an **IDOR**
(Insecure Direct Object Reference): the app takes an object id straight from the
request and hands back the object, never asking whether it belongs to the
caller.

Think of it like a hotel where the front desk checks your ID at the door
(authentication) but then gives you a key that opens *every* room, and the only
thing stopping you from entering room 207 is that nobody told you the number.
Guessing "207" isn't hacking the lock — the lock was never there. In Ledgerly
the "room number" is an invoice id in the URL.

That "object id from the request → fetch and return the object, no owner check"
shape is the **sink** you're training your eye to spot. Once you recognise it,
you find this bug in seconds.

> Want the deeper background — horizontal vs vertical escalation, how to test it
> methodically with two accounts, and the full workflow with **Burp Suite** and
> **OWASP ZAP**? Read the shared
> **[Broken Access Control field guide](https://github.com/iv0ks/appsec-labs/blob/main/docs/broken-access-control.md)**.
> This lab is a hands-on application of it.

<br>

## 🎓 What this level teaches

**Level 1 — a missing ownership check.** Ledgerly is the baseline of the series:
the detail endpoint looks up an invoice by its id and returns it with **no
verification that the invoice belongs to you**. There is no filter to defeat —
the goal is to *recognise* the raw shape of an IDOR and confirm it end to end,
before the later levels start adding (broken) defences.

- **Entry point:** `GET /api/invoices/:id`
- **The broken defence:** none — being logged in is treated as enough.
- **What you can see legitimately:** your own invoices, via `GET /api/invoices`.
- **The target:** another user's invoice, reachable only by changing the id.

## 🪧 How to approach it

1. Sign in as `alice` through your proxy and load the dashboard. Note that the
   listing shows only *her* invoices, each with a small numeric id.
2. Open one of your own invoices by id and capture that request. Re-send the
   known-good id to get your **baseline** response to compare against.
3. The id is just a number in the path. Ask yourself: what happens if you
   request an id that is **not** in your own list? Change it and watch.
4. Walk the id space until a response comes back that clearly isn't yours —
   a different client, a different amount, an internal note that isn't meant for
   you.

## 🕵️‍♂️ Going further

Because the only check is "are you logged in?", the escape doesn't stop at one
record — every invoice in the system is reachable by id. Try enumerating a range
of ids and notice how an attacker would harvest *all* customers' data in one
sweep. That bulk-exposure potential is what makes IDOR so damaging in the real
world.

## 🤔 Why it matters

IDOR is consistently among the most common and most impactful web
vulnerabilities (it sits under OWASP's #1 category, Broken Access Control). It
needs no special tooling, leaves ordinary-looking logs, and a single missing
line exposes everyone's data. Learning to spot the "id in, object out, no owner
check" sink instantly is the foundation for every later level in this series.

---

When you have captured the flag (or want to check the fix and the *why* behind
it), continue to **[SOLVE → SOLUTION.md](SOLUTION.md)**.
