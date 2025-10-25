const QUERY_PARAM_KEY = 't';

const getCurrentQueryParam = (key) => {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(key);
};

const createUpdatedUrl = (currentUrl, key, text) => {
  const url = new URL(currentUrl);
  if (text) {
    url.searchParams.set(key, encodeURIComponent(text));
  } else {
    url.searchParams.delete(key);
  }
  return url.toString();
};

const replaceUrl = (newUrl) => {
  window.history.replaceState(null, '', newUrl);
};

// Element selectors
const textarea = document.getElementById('main-textarea');
const copyButton = document.getElementById('copy-button');
const copyUrlButton = document.getElementById('copy-url-button');
const generateQrButton = document.getElementById('generate-qr-button');
const saveFileButton = document.getElementById('save-file-button');
const qrCodeContainer = document.getElementById('qr-code-container');
const qrCodeImageContainer = document.getElementById('qr-code-image');
const closeQrButton = document.getElementById('close-qr-button');

// Initial load from URL parameter
const initialText = getCurrentQueryParam(QUERY_PARAM_KEY);
if (initialText !== null) {
  textarea.value = decodeURIComponent(initialText);
  const newUrl = createUpdatedUrl(window.location.href, QUERY_PARAM_KEY, null);
  replaceUrl(newUrl);
}

// --- Logic --- 

const makeDraggable = (element) => {
  let isDragging = false;
  let initialX = 0;
  let initialY = 0;
  let xOffset = 0;
  let yOffset = 0;

  const dragStart = (e) => {
    if (e.target.id === 'close-qr-button') {
      return;
    }
    initialX = e.clientX - xOffset;
    initialY = e.clientY - yOffset;
    isDragging = true;
  };

  const drag = (e) => {
    if (!isDragging) return;
    e.preventDefault();
    const currentX = e.clientX - initialX;
    const currentY = e.clientY - initialY;
    xOffset = currentX;
    yOffset = currentY;
    element.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;
  };

  const dragEnd = () => {
    isDragging = false;
  };

  element.addEventListener('mousedown', dragStart);
  document.addEventListener('mouseup', dragEnd);
  document.addEventListener('mousemove', drag);
};

const createTimestamp = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  return `${year}${month}${day}_${hours}${minutes}${seconds}`;
};

const createFilename = (prefix, timestamp, extension) => {
  return `${prefix}_${timestamp}.${extension}`;
};

const triggerDownload = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

const generateQrCode = (size) => {
  const url = createUpdatedUrl(window.location.href, QUERY_PARAM_KEY, textarea.value);
  qrCodeImageContainer.innerHTML = '';
  new QRCode(qrCodeImageContainer, {
    text: url,
    width: size,
    height: size,
  });
};

// --- Event Handlers ---

const showTemporaryFeedback = (button, originalContent, feedbackHtml) => {
  button.innerHTML = feedbackHtml;
  button.disabled = true;

  setTimeout(() => {
    button.innerHTML = originalContent;
    button.disabled = false;
  }, 2000);
};

const onCopyButtonClick = () => {
  const originalContent = copyButton.innerHTML;
  const feedbackHtml = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon-check"><polyline points="20 6 9 17 4 12"></polyline></svg> <span>Copied!</span>';
  navigator.clipboard.writeText(textarea.value)
    .then(() => showTemporaryFeedback(copyButton, originalContent, feedbackHtml))
    .catch(err => {
      console.error('Failed to copy text: ', err);
    });
};

const onCopyUrlButtonClick = () => {
  const originalContent = copyUrlButton.innerHTML;
  const urlToCopy = createUpdatedUrl(window.location.href, QUERY_PARAM_KEY, textarea.value);
  const feedbackHtml = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon-check"><polyline points="20 6 9 17 4 12"></polyline></svg> <span>Copied!</span>';

  navigator.clipboard.writeText(urlToCopy)
    .then(() => showTemporaryFeedback(copyUrlButton, originalContent, feedbackHtml))
    .catch(err => {
      console.error('Failed to copy URL: ', err);
    });
};

const onGenerateQrButtonClick = () => {
  generateQrCode(256);
  qrCodeContainer.style.display = 'block';
};

const onSaveFileButtonClick = () => {
  const text = textarea.value;
  const timestamp = createTimestamp();
  const filename = createFilename('note', timestamp, 'txt');
  const blob = new Blob([text], { type: 'text/plain' });
  triggerDownload(blob, filename);
};

const onCloseQrButtonClick = () => {
  qrCodeContainer.style.display = 'none';
};

// --- Initializations ---

copyButton.addEventListener('click', onCopyButtonClick);
copyUrlButton.addEventListener('click', onCopyUrlButtonClick);
generateQrButton.addEventListener('click', onGenerateQrButtonClick);
saveFileButton.addEventListener('click', onSaveFileButtonClick);
closeQrButton.addEventListener('click', onCloseQrButtonClick);

qrCodeContainer.addEventListener('dragstart', (e) => e.preventDefault());

window.addEventListener('beforeunload', (e) => {
  if (textarea.value) {
    e.preventDefault();
    e.returnValue = '';
  }
});

makeDraggable(qrCodeContainer);