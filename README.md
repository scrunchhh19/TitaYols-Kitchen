# Tita Yol's Kitchen: website + order form

A single-page site with a shopping cart for the menu, a checkout flow with
GCash/bank QR payment, and an order form that writes straight into a Google
Sheet, no manual copy-pasting, and a "Today's Orders" tab that always shows
just today's orders automatically. Payment receipt screenshots are stored in
Vercel Blob storage and linked from the sheet.

## What's here

- `public/`, the actual site (HTML/CSS/JS). This is what visitors see.
- `api/order.js`, runs on Vercel's servers when someone submits the order
  form. It writes the order row to Google Sheets and uploads the receipt
  screenshot to Vercel Blob storage.
- `package.json`, the two dependencies (`googleapis` and `@vercel/blob`) the
  order function needs.

## How ordering works now

1. Visitor browses the menu and taps "+" to add à la carte dishes or
   bundles/sets to their cart (bottom-right cart button).
2. "Checkout" fills the order form's details box with a summary of their
   cart. They still fill in name, contact number, date, pickup/delivery,
   and notes themselves.
3. Submitting the form opens a payment popup with your GCash/bank QR code.
4. They upload a screenshot of their payment receipt and hit "Confirm &
   Send Order." Only at that point does anything get written to the sheet,
   there are no half-finished rows.
5. The sheet row includes a clickable link to their receipt and a "Paid"
   column, and the timestamp is recorded at that exact moment, so it should
   land close to the time on their receipt.

## Content status

The menu, logo, and photos are now the client's real content (pulled from
the package/menu image file). Two things still worth double-checking with
the client before this goes live:

- **Prices**: the à la carte tray list (`public/index.html`, the
  `alacarte` panel) was manually typed from their menu poster. Worth one
  read-through against the original poster to catch any typo before launch.
- **Hours**: the site currently just says "Open daily · closes 10 PM"
  (from the Google listing). The exact opening time was never confirmed. Worth asking the client and adding it in the Contact section
  (`public/index.html`, look for `Open daily`).

Everything else (contact info, phone numbers, Facebook link, logo, the 4.7
rating and review quote, the full bundle/set gallery, the payment QR code)
is the client's real, provided content.

## One-time setup: connecting the site to Google Sheets and Vercel Blob

### 1. Make the Google Sheet

Create a new Google Sheet (or use the one you've already made). Rename the
first tab **All Orders**, and put this header row in it:

```
Date Submitted | Customer Name | Contact Number | Order Date Needed | Pickup or Delivery | Delivery Address | Order Details | Notes | Receipt | Paid
```

Add a second tab called **Today's Orders**. In cell A1 of that tab, paste:

```
=FILTER('All Orders'!A2:J, INT('All Orders'!A2:A) = INT(TODAY()))
```

That formula automatically shows only the rows from today, no refreshing,
no manual filtering.

Grab the **Sheet ID** from the sheet's URL, it's the long string of
characters between `/d/` and `/edit`:

```
https://docs.google.com/spreadsheets/d/THIS_PART_IS_THE_ID/edit
```

### 2. Create a "service account" (a robot user that can write to the sheet)

This is the one genuinely technical step, but it's a one-time setup:

1. Go to [console.cloud.google.com](https://console.cloud.google.com) and
   create a new project (any name is fine).
2. In the search bar, look up **Google Sheets API** and click **Enable**.
3. Go to **APIs & Services → Credentials → Create Credentials → Service
   Account**. Give it any name.
4. Open the service account you just made, go to the **Keys** tab, and click
   **Add Key → Create new key → JSON**. This downloads a `.json` file, keep it safe, it's effectively a password.
5. Inside that JSON file, you'll need two values: `client_email` and
   `private_key`.

> Note: only **Google Sheets API** needs to be enabled here. Earlier
> versions of this project also used the service account to upload receipts
> to Google Drive, but that's no longer the case (see "A couple of things
> worth knowing" below), so **Google Drive API** and any Drive sharing step
> aren't needed anymore.

### 3. Share the sheet with the service account

Back in your Google Sheet, click **Share**, and paste in the
`client_email` value from the JSON file (it looks like an email address
ending in `.iam.gserviceaccount.com`). Give it **Editor** access.

### 4. Add the Google secrets to Vercel

In your Vercel project, go to **Settings → Environment Variables** and add:

| Name | Value |
|---|---|
| `GOOGLE_SHEET_ID` | the Sheet ID from step 1 |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | the `client_email` value |
| `GOOGLE_PRIVATE_KEY` | the `private_key` value, exactly as it appears in the JSON (including the `\n` characters) |

### 5. Create a Vercel Blob store for payment receipts

1. In your Vercel project, go to the **Storage** tab → **Create Database**
   → **Blob**.
2. Give it a name (e.g. "receipts") and select **Create a new Blob store**.
3. Make sure it's connected to this project, with **Production** (and
   **Preview**, if you use preview deployments) checked.

That's it, no value to copy anywhere: Vercel automatically wires up the
store's credentials for you as soon as it's connected. `api/order.js`
uploads receipt screenshots there and gets back a public link for the
sheet.

### 6. Deploy

Push this folder to a GitHub repo, then import that repo into Vercel.
Vercel will detect the `api/` folder automatically and deploy `order.js` as
a serverless function, no extra configuration needed. Once it's live, place
a test order (with a real screenshot) and check that a new row, with a
working receipt link, shows up in the sheet.

## A couple of things worth knowing

- **Receipts are stored in Vercel Blob, not Google Drive.** Drive was the
  original design, but Google blocks service accounts from using storage
  quota on a personal (non-Workspace) Google account, so uploads always
  failed with "Service Accounts do not have storage quota." Vercel Blob
  doesn't have that restriction and needs no separate credentials to set
  up, so that's what receipt screenshots use now. The public receipt link
  still lands in the sheet exactly the same way.
- **Receipt links are publicly viewable by anyone with the link.** That
  keeps setup simple (no login needed to open a link from the sheet), but
  it does mean the link isn't locked down tighter than that. Fine for a
  small business's internal use, worth knowing if that ever matters.
- **Screenshots are capped around 3MB in the browser.** Vercel's
  serverless functions cap request bodies at 4.5MB total, and a base64
  image runs about a third larger than the original file. A real GCash or
  bank app screenshot is normally well under 1MB, so this should rarely
  come up, but if it does, the customer sees a friendly message asking for
  a smaller image rather than a broken submission.
- **Bundle/set prices aren't tracked in the cart total.** Their prices live
  only on the designed poster images (not typed anywhere in the code), so
  the cart's running total only adds up à la carte items. Bundles/sets
  still show up by name and quantity in the order summary, just without a
  number attached, so you'll confirm that part with the customer directly.

## Optional next step (easy to add later)

A Vercel serverless function can just as easily send a Telegram message, an
email, or a Facebook Messenger ping the moment a new order comes in, so the
client gets notified instantly instead of having to check the sheet. Worth
adding once the site is live and he wants it.
