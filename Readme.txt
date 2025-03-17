1. Go to the Google Cloud Console.
2. Create a new project.
3. Search for the Gmail API in the Library and enable it.
4. Go to the Credentials page and create OAuth 2.0 Client ID credentials.
5. Add http://localhost:3000/oauth2callback as the authorized redirect URI.
6. Download the credentials.json file and save it in your project folder.

credentials.json should look like this 
this is just sample information
{
  "web": {
    "client_id": "619711318539-lcplm4succvlpaodfker721kfe9rhplb5.apps.googleusercontent.com",
    "project_id": "internal-sylph-454006-j9",
    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
    "token_uri": "https://oauth2.googleapis.com/token",
    "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
    "client_secret": "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",
    "redirect_uris": ["http://localhost:3001/oauth2callback"]
  }
}