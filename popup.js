// popup.js
document.addEventListener('DOMContentLoaded', function() {
    // Set up screenshot button
    document.getElementById('screenshotBtn').addEventListener('click', function() {
        chrome.runtime.sendMessage({type: 'captureScreen'}, function(response) {
            if (response && response.success) {
                alert('Screenshot saved successfully!');
            } else {
                alert('Failed to save screenshot: ' + (response ? response.error : 'Unknown error'));
            }
        });
    });
});