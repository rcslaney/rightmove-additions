let script = document.createElement('script');
script.setAttribute('type', 'text/javascript');
script.setAttribute('src', chrome.runtime.getURL('content.js'));
script.setAttribute("data-extension-id", chrome.runtime.id);
document.body.appendChild(script);