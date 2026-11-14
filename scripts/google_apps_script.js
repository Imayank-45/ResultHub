/**
 * ==============================================================================
 * ResultAI - Google Apps Script Backend (Feedback + Likes Counter)
 * ==============================================================================
 * 
 * Instructions:
 * 1. Open your Google Sheet ("Result Extractor Feedback").
 * 2. Click Extensions > Apps Script.
 * 3. Replace all code in Code.gs with this script.
 * 4. Click Deploy > New deployment (or Manage deployments > Edit > New version):
 *    - Select type: Web app
 *    - Execute as: "Me"
 *    - Who has access: "Anyone"
 * 5. Click "Deploy" and copy the Web App URL.
 * 
 * ==============================================================================
 */

var SPREADSHEET_ID = "YOUR_GOOGLE_SHEET_ID_HERE";

function doPost(e) {
  try {
    var output = ContentService.createTextOutput();
    output.setMimeType(ContentService.MimeType.JSON);

    var data = {};

    if (e && e.postData && e.postData.contents) {
      var raw = e.postData.contents;
      try {
        data = JSON.parse(raw);
      } catch (jsonErr) {
        try {
          data = {};
          var pairs = raw.split('&');
          for (var i = 0; i < pairs.length; i++) {
            var parts = pairs[i].split('=');
            if (parts.length === 2) {
              var key = decodeURIComponent(parts[0].replace(/\+/g, ' '));
              var val = decodeURIComponent(parts[1].replace(/\+/g, ' '));
              data[key] = val;
            }
          }
        } catch (urlErr) {
          data = {};
        }
      }
    }

    if ((!data || Object.keys(data).length === 0) && e && e.parameter) {
      data = e.parameter;
    }

    // Open spreadsheet
    var ss = null;
    try {
      if (SPREADSHEET_ID && SPREADSHEET_ID !== "YOUR_GOOGLE_SHEET_ID_HERE" && SPREADSHEET_ID.trim() !== "") {
        ss = SpreadsheetApp.openById(SPREADSHEET_ID.trim());
      }
    } catch (e1) {}

    if (!ss) {
      try {
        ss = SpreadsheetApp.getActiveSpreadsheet();
      } catch (e2) {}
    }

    if (!ss) {
      return output.setContent(JSON.stringify({ status: "error", message: "Spreadsheet not found." }));
    }

    // Check if request is a LIKE action
    var action = (data.action || "").toString().trim().toLowerCase();
    if (action === "like") {
      var metricsSheet = ss.getSheetByName("Likes") || ss.getSheetByName("Metrics");
      if (!metricsSheet) {
        metricsSheet = ss.insertSheet("Likes");
        metricsSheet.getRange(1, 1).setValue("Total Likes").setFontWeight("bold");
        metricsSheet.getRange(2, 1).setValue(0);
      }

      var currentLikes = parseInt(metricsSheet.getRange(2, 1).getValue(), 10);
      if (isNaN(currentLikes) || currentLikes < 0) currentLikes = 0;
      var newLikes = currentLikes + 1;
      metricsSheet.getRange(2, 1).setValue(newLikes);

      return output.setContent(JSON.stringify({
        status: "success",
        action: "like",
        total_likes: newLikes,
        message: "Like recorded successfully."
      }));
    }

    // Otherwise handle FEEDBACK form submission
    var name = (data.name || "").toString().trim();
    var email = (data.email || "").toString().trim();
    var rating = parseInt(data.rating, 10);
    var feedbackType = (data.feedback_type || data.feedbackType || "").toString().trim();
    var message = (data.message || "").toString().trim();

    if (!rating || isNaN(rating) || rating < 1 || rating > 5) {
      return output.setContent(JSON.stringify({ status: "error", message: "Rating is required (1-5 stars)." }));
    }

    if (!feedbackType) {
      return output.setContent(JSON.stringify({ status: "error", message: "Feedback category is required." }));
    }

    if (!message) {
      return output.setContent(JSON.stringify({ status: "error", message: "Message is required." }));
    }

    var sheet = ss.getSheetByName("Sheet1") || 
                ss.getSheetByName("Sheet 1") || 
                ss.getSheetByName("Feedback") || 
                ss.getSheets()[0];

    if (!sheet) {
      sheet = ss.insertSheet("Feedback");
    }

    if (sheet.getLastRow() === 0) {
      sheet.appendRow(["Timestamp", "Name", "Email", "Rating", "Feedback Type", "Message"]);
      sheet.getRange(1, 1, 1, 6).setFontWeight("bold").setBackground("#7C3AED").setFontColor("#FFFFFF");
      sheet.setFrozenRows(1);
    }

    var timestamp = Utilities.formatDate(
      new Date(),
      Session.getScriptTimeZone() || "GMT+5:30",
      "yyyy-MM-dd HH:mm:ss"
    );

    sheet.appendRow([
      timestamp,
      name || "Anonymous",
      email || "N/A",
      rating + " / 5 ⭐",
      feedbackType,
      message
    ]);

    return output.setContent(JSON.stringify({
      status: "success",
      message: "Feedback appended to sheet successfully."
    }));

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: "Apps Script Error: " + err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  var totalLikes = 0;
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    if (ss) {
      var metricsSheet = ss.getSheetByName("Likes") || ss.getSheetByName("Metrics");
      if (metricsSheet) {
        totalLikes = parseInt(metricsSheet.getRange(2, 1).getValue(), 10) || 0;
      }
    }
  } catch (err) {}

  var output = ContentService.createTextOutput(JSON.stringify({
    status: "ok",
    service: "ResultAI Feedback Endpoint",
    total_likes: totalLikes,
    message: "POST requests accepted."
  }));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}
