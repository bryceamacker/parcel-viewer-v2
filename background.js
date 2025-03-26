// background.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'download') {
        chrome.downloads.download({
            url: request.url,
            filename: request.filename
        }).then(() => {
            sendResponse({ success: true });
        }).catch((error) => {
            console.error('Download failed:', error);
            sendResponse({ success: false, error: error.message });
        });
        return true;  // Will respond asynchronously
    }
    else if (request.type === 'captureScreen') {
        // Get the current active tab first
        chrome.tabs.query({ active: true, currentWindow: true })
            .then(([tab]) => {
                if (!tab) {
                    throw new Error('No active tab found');
                }
                return chrome.tabs.update(tab.id, {active: true});
            })
            .then(() => {
                // Capture the visible tab
                console.log('Capturing screenshot...');
                return chrome.tabs.captureVisibleTab(null, {
                    format: 'png'
                });
            })
            .then((screenshot) => {
                // Get timestamp for filename
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                
                // Download the image
                return chrome.downloads.download({
                    url: screenshot,
                    filename: `screenshot-${timestamp}.png`,
                    saveAs: false
                });
            })
            .then(() => {
                sendResponse({ success: true });
            })
            .catch((error) => {
                console.error('Failed to capture screenshot:', error);
                sendResponse({ success: false, error: error.message });
            });
        return true;  // Will respond asynchronously
    }
});