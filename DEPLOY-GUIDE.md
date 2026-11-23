# 22 Agroz: Deployment Guide (no coding needed)

You will create 3 free accounts: **Neon** (database), **GitHub** (stores the code) and **Render** (runs the website). Takes about 20 to 30 minutes. Free plans change over time, so check each site's current limits.

## Step 1: Database (Neon)
1. Go to **neon.tech** and sign up.
2. Create a project (any name, e.g. `agroz`).
3. On the project page, find **Connection string** and click copy. It starts with `postgresql://`. Keep it private. This is your `DATABASE_URL`.

## Step 2: Put the code on GitHub
1. Go to **github.com** and sign up.
2. Click **+ → New repository**. Name it `22-agroz`. Choose **Private**. Click **Create repository**.
3. Click **uploading an existing file**.
4. Unzip the `22-agroz.zip` I gave you, then drag in everything inside it: `server.js`, `package.json`, `tailwind.config.js` and the `src` and `public` folders.
5. Click **Commit changes**.

## Step 3: Run the website (Render)
1. Go to **render.com**, sign up (choose "Sign in with GitHub").
2. Click **New → Web Service**, then pick your `22-agroz` repository.
3. Settings: **Language/Runtime: Node**, **Build Command: `npm install`**, **Start Command: `npm start`**, **Instance type: Free**.
4. Under **Environment Variables**, add these:
   - `DATABASE_URL` : the Neon connection string from Step 1
   - `JWT_SECRET` : any long random text (30+ characters). Never share it.
   - `ADMIN_PASSWORD` : the password only YOU will use to add, edit and delete materials
   - `NODE_ENV` : `production`
5. Click **Create Web Service** and wait for "Live". Open the web address Render shows (ends in `onrender.com`).

## Step 4: First use
1. Students just open the website address. **No account or login is needed** to view and download.
2. To add materials, scroll to the bottom and click **Admin**, then enter your `ADMIN_PASSWORD`. You will now see **＋ Add material**, **Edit** and **Delete**.

## Good to know
- **Edit:** You (admin) can change a title, subject, type, description, link or replace the file with the **Edit** button on each card.
- **Uploads:** Files up to 15 MB are stored in the database. Put videos on YouTube (Unlisted) or Google Drive and paste the link.
- **Sleep:** On the free plan the site sleeps when unused, and the first visit afterwards takes about a minute to wake up.
- **Privacy:** Anyone who has the website address can view the materials, so share it only with your batch. Only the admin password lets someone change anything.
- **Updating the design:** change files on GitHub and Render redeploys automatically.

## For developers: the tech stack
- **Frontend:** plain HTML (`public/index.html`), JavaScript (`public/app.js`) and **Tailwind CSS** (`src/input.css` compiled to `public/styles.css`).
- **Backend:** Node.js + Express, PostgreSQL (Neon), JWT cookie for the admin.
- **Changing the design:** edit the Tailwind classes in `public/index.html` or `public/app.js`, then run `npm install` and `npm run build:css` on your computer. Upload the new `public/styles.css` to GitHub and Render will redeploy. The compiled stylesheet is already included, so you don't need to do this for the first deployment.
