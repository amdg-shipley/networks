# NET/SIM — AP CSP Internet Simulator

A browser-based, multi-level network simulation for AP Computer Science Principles.
Students progress through 6 levels: binary wire → hex encoding → ASCII protocols →
TCP/IP routing → DNS resolution → multiplayer collaborative fault-tolerance lab.

---

## ⚠️ Important: Must Be Served Over HTTP

**This project uses ES6 modules and CANNOT be opened by double-clicking `index.html`.**
Browsers block module imports over `file://` due to security restrictions.

You must use one of:
- **GitHub Pages** (recommended — see deploy steps below)
- **VS Code Live Server** (right-click `index.html` → Open with Live Server)
- `python -m http.server 8080` then open `http://localhost:8080`

---

## Teacher Setup

### Step 1 — Firebase Project

Levels 1–5 work offline. Firebase is required for Level 6 multiplayer and the teacher dashboard.

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Click **Add project** → name it → Continue
3. In your project dashboard, click the **`</>`** (Web) icon to add a web app
4. Give it a name → click **Register app**
5. Copy the `firebaseConfig` object values — you'll need them in Step 3
6. Go to **Build → Realtime Database** → **Create database**
7. Choose a region → start in **test mode** (you'll set rules in Step 2)

### Step 2 — Set Firebase Security Rules

In the Firebase console: **Realtime Database → Rules**. Paste the rules provided to you separately by your department or IT contact.

> **⚠️ Note:** Do not share your Firebase rules configuration publicly.
> Do not use this project for sensitive student data.

### Step 3 — Add Your Firebase Credentials

Open `config.js` and fill in your values from Step 1. Also set a dashboard password on the line above the Firebase config.

> **⚠️ Note:** If your GitHub repository is **public**, `config.js` will be visible.
> Use a **private repo** if your school policy requires it, or ensure your
> Firebase Security Rules are scoped tightly enough to limit misuse.

### Step 4 — Deploy to GitHub Pages

1. Push the project to a GitHub repository
2. Go to your repo → **Settings → Pages**
3. Under **Source**, select **Deploy from a branch** → choose `main` → `/ (root)`
4. Click **Save**
5. After ~60 seconds, your site is live at `https://<username>.github.io/<repo-name>/`

---

## Using Room Codes in Class

Level 6 is a small-group (3–4 students) collaborative activity.

1. Before class, decide on a room code (e.g. `PERIOD3`, `ALPHA`, `B7`)
2. Write the room code on the board when students reach Level 6
3. Each student enters their name and the room code to join
4. Students see each other's nodes appear in real time
5. Up to 8 nodes per room
6. Multiple groups can work simultaneously using different room codes

**Tip:** Use a new room code for each class period to start with a clean topology.
Firebase data is never automatically deleted — clear old room data manually in the
Firebase console under **Realtime Database → Data** between periods.

---

## Teacher Dashboard

View student reflection answers in real time as they submit.

**What it shows:**
- Student reflection answers from Levels 1–5, grouped by level
- Student display names and submission times
- Filter by level, or view all at once
- Print button for a clean printout

**Student identity:** On first visit, students enter their name in a prompt before
any level loads. The name persists across sessions on that device.

---

## Resetting Student Progress

Progress is stored in each student's browser (`localStorage`).

**To reset one student:** click the gear icon (⚙) in the top-right → **Reset Progress**.

There is no built-in mass reset — each student resets individually from the settings menu.

---

## Firebase Spark (Free) Tier Limits

- 100 simultaneous connections
- 1 GB/month data transfer

A class of ~16 students uses roughly 16 connections. Well within limits for a single section.

**Recommendation:** Create one Firebase project per class section to keep data separate,
or clear room data between periods in the Firebase console.
