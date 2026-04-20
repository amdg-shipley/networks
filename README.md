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

### Step 1 — Firebase Project (for Level 6 multiplayer only)

Levels 1–5 are fully offline. You only need Firebase if you plan to use Level 6.

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Click **Add project** → name it (e.g. `ap-csp-netsim`) → Continue
3. Disable Google Analytics (optional) → **Create project**
4. In your project dashboard, click the **`</>`** (Web) icon to add a web app
5. Give it a name (e.g. `classroom`) → click **Register app**
6. Copy the `firebaseConfig` object values — you'll need them in Step 3
7. Go to **Build → Realtime Database** → **Create database**
8. Choose a region → start in **test mode** (you'll set rules in Step 4)

### Step 2 — Set Firebase Security Rules

In the Firebase console: **Realtime Database → Rules**. Paste:

```json
{
  "rules": {
    "rooms": {
      "$roomCode": {
        ".read": true,
        ".write": true
      }
    }
  }
}
```

> **⚠️ Warning:** These rules allow anyone who knows a room code to read and write.
> This is appropriate for a supervised classroom session but is NOT production-safe.
> Do not use this project for sensitive data.

### Step 3 — Add Your Firebase Credentials

Open `config.js` and fill in your values:

```js
export const firebaseConfig = {
  apiKey:            "AIzaSy...",
  authDomain:        "ap-csp-netsim.firebaseapp.com",
  databaseURL:       "https://ap-csp-netsim-default-rtdb.firebaseio.com",
  projectId:         "ap-csp-netsim",
  storageBucket:     "ap-csp-netsim.appspot.com",
  messagingSenderId: "1234567890",
  appId:             "1:1234567890:web:abc123",
};
```

> **⚠️ Note:** `config.js` is committed to your repo (it's required for GitHub Pages to
> work without a build step). If your repo is **public**, anyone can see these credentials.
> Protect against misuse by keeping your Firebase Security Rules scoped tightly.
> Consider using a **private repo** if your school policy requires it.

### Step 4 — Deploy to GitHub Pages

1. Push the project to a GitHub repository (public or private)
2. Go to your repo → **Settings → Pages**
3. Under **Source**, select **Deploy from a branch** → choose `main` (or `master`) → `/ (root)`
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
Firebase data is never automatically deleted — old room data stays unless you clear it
manually in the Firebase console under **Realtime Database → Data**.

---

## Resetting Student Progress

Progress is stored in each student's browser (`localStorage`).

**To reset one student:**
- Click the gear icon (⚙) in the top-right → **Reset Progress**

**To reset all students at once:**
No built-in mass reset — each student must reset individually, or you can
instruct students to open the browser console and run:
```js
localStorage.removeItem('netsim_progress'); location.reload();
```

---

## Teacher Dashboard (Student Answers)

Open `dashboard.html` in your browser (same server as the main app) to see student
reflection answers in real time as students submit them.

URL: `https://<your-github-pages-site>/dashboard.html`

**What it shows:**
- All students' reflection answers from Levels 1–5, grouped by level
- Student display names (entered at their first level load)
- Submission times
- Tabs to filter by level, or view all at once
- Print button for a clean black-and-white printout

**Student identity:** On first visit, students see a small non-blocking name bar at the
top of the level: *"Your name: [ _______ ] Save — So your teacher can see your answers."*
Once entered, the name persists across all levels and sessions on that device.

**Note:** Dashboard responses are stored under `/responses/` in your Firebase project.
Students self-identify by name — there is no login system. Appropriate for low-stakes
classroom use.

---

## Firebase Spark (Free) Tier Limits

- 100 simultaneous connections
- 1 GB/month data transfer

A class of 30 students uses ~30 connections. Well within limits for a single class.
If you use this across multiple class periods or share a Firebase project with other
teachers, monitor usage in the Firebase console dashboard.

**Recommendation:** Create one Firebase project per class section, or clear room data
between periods.

---

## File Structure

```
/
├── index.html          App shell
├── config.js           Firebase config placeholder (teacher fills in)
├── .gitignore
├── README.md
├── styles/
│   ├── base.css        Colors, fonts, reset
│   ├── layout.css      App grid, nav, terminal, concept panel
│   ├── components.css  Buttons, modals, forms
│   └── levels.css      SVG nodes, edges, packet animations
└── js/
    ├── app.js          Entry point, routing, progress
    ├── utils/          Shared utilities (animation, encoding, pathfinding…)
    ├── components/     Concept panel, glossary, ASCII table
    ├── levels/         level1.js – level6.js
    └── firebase/       db.js, sync.js (Level 6 only)
```
