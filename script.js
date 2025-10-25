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

// --- Event Handlers ---

const showSuccessFeedback = (button, originalContent) => {
  button.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon-check"><polyline points="20 6 9 17 4 12"></polyline></svg> <span>Copied!</span>';
  button.disabled = true;

  setTimeout(() => {
    button.innerHTML = originalContent;
    button.disabled = false;
  }, 2000);
};

const onCopyButtonClick = () => {
  const originalContent = copyButton.innerHTML;
  navigator.clipboard.writeText(textarea.value)
    .then(() => showSuccessFeedback(copyButton, originalContent))
    .catch(err => {
      console.error('Failed to copy text: ', err);
    });
};

const onCopyUrlButtonClick = () => {
  const originalContent = copyUrlButton.innerHTML;
  const urlToCopy = createUpdatedUrl(window.location.href, QUERY_PARAM_KEY, textarea.value);

  navigator.clipboard.writeText(urlToCopy)
    .then(() => showSuccessFeedback(copyUrlButton, originalContent))
    .catch(err => {
      console.error('Failed to copy URL: ', err);
    });
};

const onGenerateQrButtonClick = () => {
  const url = createUpdatedUrl(window.location.href, QUERY_PARAM_KEY, textarea.value);
  
  qrCodeImageContainer.innerHTML = '';

  new QRCode(qrCodeImageContainer, {
    text: url,
    width: 256,
    height: 256,
  });

  qrCodeContainer.style.display = 'block';
};

const onCloseQrButtonClick = () => {
  qrCodeContainer.style.display = 'none';
};

// --- Initializations ---

copyButton.addEventListener('click', onCopyButtonClick);
copyUrlButton.addEventListener('click', onCopyUrlButtonClick);
generateQrButton.addEventListener('click', onGenerateQrButtonClick);
closeQrButton.addEventListener('click', onCloseQrButtonClick);

qrCodeContainer.addEventListener('dragstart', (e) => e.preventDefault());

makeDraggable(qrCodeContainer);