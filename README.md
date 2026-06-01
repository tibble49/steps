# Step Challenge

A lightweight web app to track a walking challenge between friends.

## Features

- Add and remove participants
- Set team colors per participant
- Log daily steps per participant
- Block duplicate entries for the same person and date
- Live leaderboard with totals and daily averages
- Visual race view with moving icons based on leaderboard position
- QR code shortcuts per participant (scan or copy link for quick entry)
- Recent activity feed
- Entry calendar showing daily completion by participant
- Cloud persistence using Firebase Firestore
- Current challenge window locked to June 1 to June 30, 2026
- Automatic fresh reset when challenge month changes (participants/colors kept, entries cleared)

## Run

1. Open `index.html` in your browser.
2. Start adding participants and daily entries.

No build tools or installs are required.

## Notes

- Data is stored in Firebase Firestore under `challenge/state`.
