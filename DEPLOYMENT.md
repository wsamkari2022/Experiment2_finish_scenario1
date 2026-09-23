# Experiment 2 — Server Deployment (with MongoDB)

How to put Experiment 2 on the Linux server (`fac-eskridge-m1.fit.edu`) on **port 4000**,
replacing Experiment 1, with its own MongoDB database **`VRDS2`** on the same server.

---

## How it fits together

```
 Participant's browser
        │  https://<your public address>  →  port 4000
        ▼
 ┌───────────────────────── one Node process (PM2 app "experiment2-4000") ─┐
 │  /            → the study pages (built into dist/)                        │
 │  /api/...     → server/index.js  ── reads .env ──►  MONGO_URL, MONGO_DB    │
 └───────────────────────────────────────┬──────────────────────────────────┘
                                         │ 127.0.0.1:27017 (never leaves the server)
                                         ▼
                        MongoDB on the same server
                          ├── wildfire   ← Experiment 1 (left untouched)
                          └── VRDS2      ← Experiment 2 (new)
```

- The browser never talks to MongoDB. Only `server/index.js` does, using the password in `.env`.
- `.env` lives **only on the server**. It is not in Git and must never be uploaded or emailed.
- Stopping Experiment 1 stops its *program*. Its `wildfire` database and all its data stay.

---

## Part A — Create the `VRDS2` database and its user (one time only)

> **Good news:** MongoDB has no "create database" command. A database appears the first time
> something is written to it. Experiment 2 does this itself when it starts: it creates the
> `participants` collection and its indexes inside `VRDS2`. Your job is only to create a
> **user** that is allowed to write to `VRDS2`.

### A1. Log in to the server

```bash
ssh wsamkari2022@fac-eskridge-m1.fit.edu
```

### A2. Check MongoDB is running

```bash
sudo systemctl status mongod
```

Look for `active (running)`. Press `q` to leave.

### A3. Generate a password for the new user

```bash
openssl rand -hex 24
```

Copy the result and keep it somewhere safe (a password manager). It uses only letters and digits,
so it is safe inside a connection URL.

### A4. Open the MongoDB shell as your admin user

```bash
mongosh --host 127.0.0.1 --port 27017 -u YOUR_ADMIN_USERNAME -p --authenticationDatabase admin
```

It asks for the admin password. Don't remember the admin username? See **Part E** below.

### A5. Create the Experiment 2 user

Inside `mongosh`, type:

```js
use admin
```

```js
db.createUser({
  user: "vrds2_user",
  pwd: passwordPrompt(),
  roles: [ { role: "readWrite", db: "VRDS2" } ]
})
```

`passwordPrompt()` asks for the password; paste the one from A3. You should see `{ ok: 1 }`.

Why this shape (it matches how `wildfire_user` was set up):
- The user is stored in **`admin`**, which is why the URL ends in `authSource=admin`.
- The role is **`readWrite` on `VRDS2` only**. This user cannot read or change `wildfire`.

Leave the shell:

```js
exit
```

### A6. Test the new login

```bash
mongosh --host 127.0.0.1 --port 27017 -u vrds2_user -p --authenticationDatabase admin VRDS2
```

Then:

```js
db.runCommand({ connectionStatus: 1 })
```

Under `authenticatedUserRoles` you should see `readWrite` on `VRDS2`. `exit` to leave.
(`show collections` is empty until Experiment 2 has started once. That is normal.)

---

## Part B — Upload the project

Upload the folder **`Experiment VRDS 2`** (the one containing `package.json`) to the server.

**Skip** these when uploading. They are rebuilt on the server, and `node_modules` from Windows
contains Windows-only files:

- `node_modules/`
- `dist/`
- `.git/` (optional)

The folder name contains spaces, so always quote it on the server, for example:

```bash
cd ~/"Experiment VRDS 2"
```

---

## Part C — Create `.env` on the server

```bash
cd ~/"Experiment VRDS 2"
cp .env.example .env
nano .env
```

Replace `CHANGE_ME` with the password from A3, so the lines read:

```
MONGO_URL=mongodb://vrds2_user:THE_PASSWORD_FROM_A3@127.0.0.1:27017/VRDS2?authSource=admin
MONGO_DB=VRDS2
```

Save (`Ctrl+O`, `Enter`) and exit (`Ctrl+X`). Then lock the file so only you can read it:

```bash
chmod 600 .env
```

---

## Part D — Start Experiment 2

```bash
cd ~/"Experiment VRDS 2"
chmod +x build-and-run.sh stop-project.sh
./build-and-run.sh
```

The script runs nine steps:

| Step | What it does |
|---|---|
| 1 | Checks Node.js is **20.19+ or 22.12+** |
| 2 | Reads `.env`; refuses to continue if it is missing or still says `CHANGE_ME` |
| 3 | `npm ci` |
| 4 | `npm run build` |
| 5 | Confirms `dist/index.html` exists |
| 6 | **Logs in to MongoDB.** If this fails, it stops here and nothing is taken offline |
| 7 | Stops the old site (PM2 app `unified-4000`) and any previous Experiment 2 |
| 8 | Starts PM2 app `experiment2-4000` |
| 9 | Checks the page loads **and** `/api/health` reaches the database |

A successful run ends like this:

```
==================================================
 Experiment 2 successfully started.
==================================================
 Port     : 4000  (bound to 0.0.0.0)
 PID      : 12345
 Mode     : pm2
 Database : VRDS2
 Log      : .../logs/server.log
            .../logs/server-error.log
            live view: pm2 logs experiment2-4000
 Health   : http://localhost:4000/api/health
            {"ok":true,"database":"VRDS2","url":"mongodb://vrds2_user:***@127.0.0.1:27017/VRDS2?authSource=admin","participants":0}

 Safe to close the SSH session now - the server keeps running.
 To stop it later:  ./stop-project.sh
==================================================
```

The password always shows as `***`, both here and in the logs.

You can now close SSH. To stop the site later:

```bash
cd ~/"Experiment VRDS 2"
./stop-project.sh
```

To deploy a newer version: upload it, keep the **same `.env`** (copy it across on the server),
and run `./build-and-run.sh` again.

---

## Part E — If you don't remember the admin login

**1. See whether authentication is on at all:**

```bash
grep -A2 "^security" /etc/mongod.conf
```

`authorization: enabled` means logins are required (expected, since `wildfire_user` exists).

**2. Check whether `wildfire_user` can create users.** Log in with it:

```bash
mongosh --host 127.0.0.1 --port 27017 -u wildfire_user -p --authenticationDatabase admin
```

```js
db.runCommand({ connectionStatus: 1 }).authInfo.authenticatedUserRoles
```

If the list includes `root`, `userAdminAnyDatabase` or `userAdmin` on `admin`, this user can run
step A5. Use it.

**3. Last resort, requires sudo:** temporarily switch authentication off, create a new admin, and
switch it back on.

First confirm MongoDB only listens on the server itself, so nobody else can connect while
authentication is off:

```bash
grep -A3 "^net" /etc/mongod.conf
```

`bindIp` must be `127.0.0.1`. If it isn't, stop and ask IT before continuing.

```bash
sudo cp /etc/mongod.conf /etc/mongod.conf.backup
sudo nano /etc/mongod.conf
```

Put `#` in front of the two lines `security:` and `  authorization: enabled`, save, then:

```bash
sudo systemctl restart mongod
mongosh --host 127.0.0.1 --port 27017
```

```js
use admin
db.createUser({ user: "vrds_admin", pwd: passwordPrompt(), roles: [ { role: "userAdminAnyDatabase", db: "admin" } ] })
exit
```

Now **immediately** turn authentication back on:

```bash
sudo cp /etc/mongod.conf.backup /etc/mongod.conf
sudo systemctl restart mongod
```

Check it really requires a login again:

```bash
grep -A2 "^security" /etc/mongod.conf
```

Then continue at step **A4** using `vrds_admin`.

---

## Part F — View the data in MongoDB Compass (from your laptop)

MongoDB is not open to the internet, so Compass reaches it through an SSH tunnel, just as it
does for `wildfire`.

**1. Open the tunnel** in a Windows terminal and leave that window open. The two
`ServerAlive` options stop it dropping with `Connection reset`:

```bash
ssh -N -o ServerAliveInterval=60 -o ServerAliveCountMax=3 -L 27018:127.0.0.1:27017 wsamkari2022@fac-eskridge-m1.fit.edu
```

**2. In Compass,** add a new connection with this URI:

```
mongodb://vrds2_user:THE_PASSWORD_FROM_A3@localhost:27018/VRDS2?authSource=admin&directConnection=true
```

Port **27018** is your laptop's end of the tunnel; it arrives at 27017 on the server.

If Compass stops responding, the tunnel has probably closed. Run step 1 again, then reconnect.

---

## Troubleshooting

**Logs:**

```bash
tail -n 100 logs/server.log
```

```bash
tail -n 100 logs/server-error.log
```

**Is it running?**

```bash
pm2 status
```

```bash
pm2 logs experiment2-4000 --lines 100
```

**Does the site reach the database?**

```bash
curl -s http://localhost:4000/api/health
```

**What is using port 4000?**

```bash
sudo ss -tulpn | grep :4000
```

**Versions:**

```bash
node -v && npm -v && mongosh --version
```

**Common messages from step 6:**

| Message | Meaning | Fix |
|---|---|---|
| `Authentication failed` | Wrong username or password, or `authSource` is not `admin` | Re-check `.env` against A3–A5 |
| `not authorized` / `requires authentication` | User exists but lacks `readWrite` on `VRDS2` | Repeat A5 with the right role |
| `ECONNREFUSED` | MongoDB is not running | `sudo systemctl start mongod` |
