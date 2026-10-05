const { google } = require('googleapis');

const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS),
  scopes: [
    'https://www.googleapis.com/auth/documents',
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive'
  ]
});

const docs = google.docs({ version: 'v1', auth });
const sheets = google.sheets({ version: 'v4', auth });
const drive = google.drive({ version: 'v3', auth });

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  try {
    const { studentId, submission } = JSON.parse(event.body);

    // Create Google Doc
    const driveResponse = await drive.files.create({
      resource: {
        name: `Theme-Studio-${studentId}-${new Date().toLocaleDateString()}`,
        mimeType: 'application/vnd.google-apps.document',
        parents: [process.env.SUBMISSIONS_FOLDER_ID]
      }
    });

    const docId = driveResponse.data.id;

    // Add content to doc
    const peerProtocol = submission.peerReviews || [];
    const peerContent = peerProtocol.length > 0 
      ? `PEER PROTOCOL\n${peerProtocol.map((review, i) => `Item ${i + 1} Explanation: ${review}`).join('\n\n')}\n\n`
      : '';

    const docContent = `Theme Studio Submission

Student ID: ${studentId}
Submitted: ${new Date().toLocaleString()}

STORY ANALYSIS
Thematic Claim: ${submission.storyClaim}
Evidence: ${submission.evidenceReason}
Rival Interpretation: ${submission.rival}

CLAIM REFINEMENT
Repaired Claim: ${submission.repair}
Claim Resilience: ${submission.twistAnswer}
Confidence: ${submission.certainty}/5

FILM ANALYSIS
Film: ${submission.film}
Theme: ${submission.theme}

Scene 1: ${submission.sceneA}
Analysis: ${submission.whyA}

Scene 2: ${submission.sceneB}
Analysis: ${submission.whyB}

Challenge: ${submission.challenge}

FULL DEFENSE
${submission.draft}

${peerContent}END OF SUBMISSION`;

    await docs.documents.batchUpdate({
      documentId: docId,
      requestBody: {
        requests: [{
          insertText: { text: docContent }
        }]
      }
    });

    // Log to Google Sheet
    await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.GRADES_SHEET_ID,
      range: 'Sheet1!A1',
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[
          new Date().toLocaleString(),
          studentId,
          submission.classCode || 'Connexus',
          submission.film,
          submission.theme,
          submission.sceneA.substring(0, 50),
          submission.sceneB.substring(0, 50),
          submission.challenge.substring(0, 50),
          submission.draft.substring(0, 50),
          0, 0, 0, 0, 0, 0,
          `https://docs.google.com/document/d/${docId}/edit`,
          'Submitted'
        ]]
      }
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        docId,
        message: `Submission received. View your work: https://docs.google.com/document/d/${docId}/edit`
      })
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
