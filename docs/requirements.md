# My Kahoot — Requirements v1

Status: approved, 2026-11-25. Hosting target: free tiers (Supabase + Vercel).

## 1. Purpose
A live quiz game run in rounds during a lecture: 2–3 questions → lecture → more questions → … Audiences: youth movements/high schools and senior audiences.

## 2. Users & roles
- **Host**: one admin (Meron). Single account, simple login. No multi-user management in v1.
- **Participant**: no account. Joins via QR code (PIN fallback) + nickname.
  - Optional per quiz: ask for phone number.
    - The field is always optional to the participant
    - Short Hebrew consent line explaining the purpose
    - Numbers are deleted automatically after N days (default 30), and can be exported before then

## 3. Language & UI
- Hebrew-first, full RTL (logical CSS properties, `dir="rtl"`, correct bidi for punctuation/numbers).
- Large fonts and tap targets on phones (seniors).

## 4. Question types
- Multiple choice (2–4 answers, one correct)
- True/False
- Per question: text, optional image, timer (configurable seconds, or no timer), optional explanation shown with the correct answer.

## 5. Quiz structure
- The host keeps a library of quizzes; each live run is a separate session with its own PIN/QR.
- Quiz → ordered **rounds** → questions.
- Scoring mode set per quiz:
  - `speed`: points + speed bonus + leaderboard
  - `points`: points, no speed bonus, leaderboard
  - `results`: no scores, show answer distribution + correct answer only

## 6. Live session flow
1. Host opens quiz → session created → projector shows QR + PIN + joined-players list.
2. Participants who scan the QR see the join screen with the quiz title, then a waiting screen. They never see other quizzes.
3. Host starts round 1 → questions are shown one by one on the projector **and** in full on participants' phones.
4. After each question: answer distribution, correct answer, explanation; leaderboard (if the scoring mode has one).
5. End of round → **paused** state: projector shows "see you soon" / current standings. Host switches back to the slides tab.
6. Host resumes the next round whenever ready. Same players, scores carried over.
7. Final round → final podium/results.
- Pause scope: within the same session; session expires ~24h after creation. An expired or finished session shows "this quiz has ended".
- Players who reconnect (phone locked, refresh) return to their identity and score automatically.
- Late joiners can enter between rounds.

## 7. Lecture integration
- Quiz runs in a separate browser tab alongside PowerPoint/Google Slides. No slide hosting.

## 8. Authoring
- Web editor: create/edit quizzes, rounds, questions, upload images, reorder.
- Import from Google Sheet / Excel (CSV/XLSX template with defined columns).

## 9. Projector audio
- Lobby music and sound effects on the projector, with a mute toggle.

## 10. Non-functional
- Scale: up to ~150 concurrent participants per session.
- Cost: $0 hosting at this scale; optional domain.
- Works on any modern phone browser; no app install.

## 11. Out of scope for v1
- Post-lecture reports (live results only; phone-number export is the one exception, see §2)
- Video/audio in questions
- Multiple hosts / multi-tenant
- Cross-day resume
- Slides inside the app
