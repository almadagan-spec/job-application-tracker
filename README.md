# Job Application Tracker

An app to help you apply to jobs faster: it keeps a table of every company
you're applying to, checks the company is real, and writes you a tailored
resume and cover letter for each one — using AI, based on your real resume
(nothing invented, just re-emphasized to fit each company).

## What it does

1. **Sign up** — enter your name and email, get a 6-digit code by email to
   confirm it's really you, then you're in.
2. **Your workspace** — three buttons at the top:
   - **Upload resume** — pick your resume file from your computer.
   - **Desired role** — type in plain words the kind of job you want
     (e.g. "product manager", "head of engineering").
   - **+ Add a company** — type a company's name. The app checks Google and
     LinkedIn to make sure it's a real company. If it can't find it, that
     row turns red with a message, and you can edit the name and try again.
3. **The table** — one row per company, with: the company name, a short
   "what this company does" summary, your resume rewritten to emphasize
   what matters to that company (with a Download button), a cover letter
   for that company (with a Download button), and a status dropdown
   (Received = grey, Upon examination = yellow, Denied = red, Waiting for
   interview = green).

## Before it fully works: 3 things to set up

The app is fully built and ready, but three parts of it need to "phone" an
outside service to work — and each of those needs a free account and a
secret password (called an **API key**) that only you can create. I can't
create these for you (they're tied to your own accounts), but here's
exactly how, in order:

### 1. Supabase (stores your data + sends the email code) — required

This is the account system and the filing cabinet where your data (resume,
companies, statuses) is kept.

1. Go to [supabase.com](https://supabase.com) and create a free account and
   a new project.
2. Once it's created, open the **SQL Editor** (left sidebar), paste in the
   entire contents of this project's `supabase/schema.sql` file, and click
   **Run**. This sets up the "drawers" (tables) the app needs.
3. Go to **Project Settings → API**. You'll see a **Project URL** and an
   **`anon` `public`** key — copy both of those (never copy the
   "service_role" one, that one's more sensitive and unused here).
4. Those two values need to go in two places:
   - On your own computer, if you ever run the app locally: copy
     `.env.example` to a new file named `.env` and paste them in.
   - For the live website: add them as **repository secrets** on GitHub —
     go to this repository's **Settings → Secrets and variables →
     Actions**, and add two secrets named `VITE_SUPABASE_URL` and
     `VITE_SUPABASE_ANON_KEY` with the values you copied.
5. One more thing so the email actually contains a typed-in **code** (not
   just a click-this-link button): in Supabase, go to
   **Authentication → Emails → Magic Link**, and make sure the email
   template includes `{{ .Token }}` somewhere in the text (that's the
   6-digit code). Supabase includes this by default in most projects, but
   it's worth checking.

### 2. Google Search key (checks if a company is real) — required for the "+ Add a company" button

1. Go to the [Google Cloud Console](https://console.cloud.google.com/),
   create a project (or use an existing one), and enable the **Custom
   Search API**.
2. Create an API key (under **APIs & Services → Credentials**).
3. Separately, go to [Programmable Search Engine](https://programmablesearchengine.google.com/),
   create a new search engine, and set it to **search the entire web**.
   Copy its **Search engine ID**.
4. You'll set both of these as secrets on Supabase directly (not GitHub) —
   see the "Turning on the AI features" section below for exactly how.

### 3. Anthropic (Claude) key (writes the resume, cover letter, and company summary) — required for the table to fill itself in

1. Go to [console.anthropic.com](https://console.anthropic.com), create an
   account, and create an API key.
2. You'll set this as a secret on Supabase directly too (next section).

### Turning on the AI features (connecting the keys to the app's "brains")

The company-checking and AI-writing logic runs in small pieces of code
called **Edge Functions**, hosted by Supabase, so your secret keys are
never exposed in the website itself. To turn them on (needs a computer with
Node.js installed — this part is more technical, happy to walk through it
live):

```bash
npm install -g supabase
supabase login
supabase link --project-ref YOUR_PROJECT_REF   # found in your Supabase project's URL
supabase secrets set GOOGLE_SEARCH_API_KEY=your-google-key
supabase secrets set GOOGLE_SEARCH_CX=your-search-engine-id
supabase secrets set ANTHROPIC_API_KEY=your-anthropic-key
supabase functions deploy verify-company
supabase functions deploy generate-application
supabase functions deploy extract-resume
```

## Turning on the website itself (GitHub Pages)

One-time setup in this repository's web page on GitHub: go to
**Settings → Pages** and set **Source** to **GitHub Actions**. After that,
every update pushed to the `main` branch automatically publishes the site
to:

```
https://almadagan-spec.github.io/job-application-tracker/
```

## Running it on your own computer (optional, for testing)

```bash
npm install
npm run dev
```

## Scripts

- `npm run dev` — start a local copy to test with
- `npm run build` — check everything and build the live version
- `npm run lint` — check the code for issues
