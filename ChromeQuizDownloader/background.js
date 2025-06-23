chrome.action.onClicked.addListener((tab) => {
  chrome.scripting.executeScript({
    target: {tabId: tab.id},
    files: ['content.js']
  });
});

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg.downloadUrl && msg.filename) {
    chrome.downloads.download({
      url: msg.downloadUrl,
      filename: msg.filename,
      saveAs: true
    });
  }
});
