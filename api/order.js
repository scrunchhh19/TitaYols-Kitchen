// This runs on Vercel's servers whenever the order form is submitted.
// It never runs in the customer's browser, so the Google credentials below
// stay private, they only exist as environment variables on Vercel.

const { google } = require('googleapis');
const { Readable } = require('stream');

// Formats a date as "M/D/YYYY H:MM:SS" so Google Sheets recognizes it as a
// real date+time value (not just text) once it lands in the sheet. That's
// what lets the "Today's Orders" tab filter by date automatically, and lets
// this timestamp be matched against the time on a payment receipt.
function formatForSheets(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return (
    `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  );
}

// Vercel serverless functions cap request bodies at 4.5MB. A base64 image
// is about 33% bigger than the original file, so this catches an
// oversized upload before it ever reaches Google.
const MAX_RECEIPT_BYTES = 4 * 1024 * 1024;

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const {
      name, contact, dateNeeded, fulfillment, orderDetails, notes,
      receiptImage, receiptFileName,
    } = req.body;

    if (!name || !contact || !dateNeeded || !fulfillment || !orderDetails) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }
    if (!receiptImage || typeof receiptImage !== 'string') {
      res.status(400).json({ error: 'A payment receipt screenshot is required' });
      return;
    }

    const auth = new google.auth.JWT(
      process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      null,
      (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
      [
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/drive.file',
      ]
    );

    let receiptLink = '';
    let paidStatus = 'No';

    // --- Upload the payment screenshot to Drive, if one was sent ---
    if (receiptImage && typeof receiptImage === 'string') {
      const match = receiptImage.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
      if (!match) {
        res.status(400).json({ error: 'Receipt image was not a valid image file' });
        return;
      }
      const mimeType = match[1];
      const base64Data = match[2];
      const buffer = Buffer.from(base64Data, 'base64');

      if (buffer.length > MAX_RECEIPT_BYTES) {
        res.status(400).json({ error: 'Receipt image is too large' });
        return;
      }

      const drive = google.drive({ version: 'v3', auth });
      const bufferStream = new Readable();
      bufferStream.push(buffer);
      bufferStream.push(null);

      const safeName = (receiptFileName || 'receipt').replace(/[^a-zA-Z0-9._-]/g, '_');
      const driveFile = await drive.files.create({
        requestBody: {
          name: `${Date.now()}_${safeName}`,
          parents: process.env.GOOGLE_DRIVE_FOLDER_ID ? [process.env.GOOGLE_DRIVE_FOLDER_ID] : undefined,
        },
        media: { mimeType, body: bufferStream },
        fields: 'id',
      });

      const fileId = driveFile.data.id;

      // Make it viewable by anyone with the link, so clicking it from the
      // sheet works without needing to be signed into a specific account.
      await drive.permissions.create({
        fileId,
        requestBody: { role: 'reader', type: 'anyone' },
      });

      receiptLink = `https://drive.google.com/file/d/${fileId}/view`;
      paidStatus = 'Yes';
    }

    const sheets = google.sheets({ version: 'v4', auth });

    await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: "'All Orders'!A:I",
      valueInputOption: 'USER_ENTERED', // lets Sheets parse the date/time as a real date, not text
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values: [[
          formatForSheets(new Date()),
          name,
          contact,
          dateNeeded,
          fulfillment,
          orderDetails,
          notes || '',
          receiptLink,
          paidStatus,
        ]],
      },
    });

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Order submission failed:', err);
    res.status(500).json({ error: 'Could not save order' });
  }
};
