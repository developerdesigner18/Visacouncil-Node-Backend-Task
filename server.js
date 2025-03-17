const express = require("express");
const multer = require("multer");
const PDFDocument = require("pdfkit");
const fs = require("fs").promises;
const app = express();
const upload = multer({ dest: "uploads/" }); // Temporary folder for uploads
const path = require("path");
const process = require("process");
const { authenticate } = require("@google-cloud/local-auth");
const { google } = require("googleapis");

// If modifying these scopes, delete token.json.
const SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"];
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const TOKEN_PATH = path.join(process.cwd(), "token.json");
const CREDENTIALS_PATH = path.join(process.cwd(), "credentials.json");

// * Reads previously authorized credentials from the save file.
async function loadSavedCredentialsIfExist() {
  try {
    const content = await fs.readFile(TOKEN_PATH);
    const credentials = JSON.parse(content);
    return google.auth.fromJSON(credentials);
  } catch (err) {
    return null;
  }
}
// * Serializes credentials to a file compatible with GoogleAuth.fromJSON.
async function saveCredentials(client) {
  const content = await fs.readFile(CREDENTIALS_PATH);
  const keys = JSON.parse(content);
  const key = keys.installed || keys.web;
  const payload = JSON.stringify({
    type: "authorized_user",
    client_id: key.client_id,
    client_secret: key.client_secret,
    refresh_token: client.credentials.refresh_token,
  });
  await fs.writeFile(TOKEN_PATH, payload);
}
// * Load or request or authorization to call APIs.
async function authorize() {
  try {
    console.log("authentication ");
    let client = await loadSavedCredentialsIfExist();
    if (client) {
      return client;
    }
    client = await authenticate({
      scopes: SCOPES,
      keyfilePath: CREDENTIALS_PATH,
    });
    if (client.credentials) {
      await saveCredentials(client);
    }
    return client;
  } catch (err) {
    console.log(err);
    return err;
  }
}

/**
 * Lists the labels in the user's account.
 *
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 */
// async function listLabels(auth) {
//     const gmail = google.gmail({ version: "v1", auth });
//     const res = await gmail.users.labels.list({
//         userId: "me",
//     });
//     const labels = res.data.labels;
//     if (!labels || labels.length === 0) {
//         console.log("No labels found.");
//         return;
//     }
//     console.log("Labels:");
//     labels.forEach((label) => {
//         console.log(`- ${label.name}`);
//     });
// }

// authorize().then(listLabels).catch(console.error);

app.post("/generate-pdf", upload.single("image"), (req, res) => {
  const { text } = req.body;
  const imagePath = req.file?.path;

  if (!text || !imagePath) {
    return res.status(400).json({ error: "Image and text are required" });
  }

  const pdf = new PDFDocument({
    size: "A4",
    layout: "portrait",
  });

  pdf.pipe(res); // Stream directly to response

  // Draw image as background
  pdf.image(imagePath, 0, 0, {
    width: pdf.page.width,
    height: pdf.page.height,
  });

  // Centered text
  pdf.fontSize(24).fillColor("black");
  const textWidth = pdf.widthOfString(text);
  const textHeight = pdf.currentLineHeight();
  pdf.text(
    text,
    (pdf.page.width - textWidth) / 2,
    (pdf.page.height - textHeight) / 2
  );
  pdf.on("finish", () => {
    fs.unlinkSync(imagePath); // Cleanup uploaded image
  });
  pdf.end();
});
app.get("/oauth2callback", async (req, res) => {
  try {
    const code = req.query.code;
    if (!code) {
      return res.status(400).send("Authorization code not found");
    }

    // Load credentials from file
    const content = await fs.readFile(CREDENTIALS_PATH);
    const keys = JSON.parse(content);
    console.log(keys);
    const key = keys.installed || keys.web;

    // Create OAuth client
    const oauth2Client = new google.auth.OAuth2(
      key.client_id,
      key.client_secret,
      key.redirect_uris[0]
    );

    // Exchange authorization code for tokens
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Save the token
    const payload = JSON.stringify({
      type: "authorized_user",
      client_id: key.client_id,
      client_secret: key.client_secret,
      refresh_token: tokens.refresh_token,
    });
    await fs.writeFile(TOKEN_PATH, payload);

    res.send("Authentication successful! You can close this window.");
  } catch (error) {
    console.error("Error during OAuth callback:", error);
    res.status(500).send("Authentication failed: " + error.message);
  }
});

app.post("/email-list", async (req, res) => {
  try {
    // Authorize the client
    console.log("email list");
    const client = await authorize(); // This will load or authenticate the user
    console.log("email list back");
    const oauth2Client = client; // The client returned from authorize() is the oauth2Client

    // Initialize Gmail API client
    const gmail = google.gmail({ version: "v1", auth: oauth2Client });

    // List the user's messages (limit to 10)
    const response = await gmail.users.messages.list({
      userId: "me",
      maxResults: 10,
    });
    // console.log("------0", response.data.messages, "------0");
    // Check if messages exist in the response
    const messages = response.data.messages || [];

    if (messages.length === 0) {
      return res.status(200).json({ message: "No emails found." });
    }

    // Fetch the full details of each email (optional)
    const emailDetailsPromises = messages.map(async (message) => {
      const messageDetails = await gmail.users.messages.get({
        userId: "me",
        id: message.id,
      });
      return messageDetails.data;
    });

    const emailDetails = await Promise.all(emailDetailsPromises);

    // Respond with the details of the emails
    res.status(200).json(emailDetails);
  } catch (error) {
    console.error("Error fetching email list:", error);
    res.status(500).send("Error fetching emails: " + error.message);
  }
});

const PORT = 3000;
app.listen(PORT, () =>
  console.log(`Server running on http://localhost:${PORT}`)
);
