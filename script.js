const QUERY_PARAM_KEY = 't';
const MAX_TEXT_LENGTH_FOR_COPY_URL_BUTTON = 2000;
const MAX_TEXT_LENGTH_FOR_QR_CODE_BUTTON = 2000;
const COPY_BANNER_DISPLAY_DURATION = 5000;
const COPY_FEEDBACK_DURATIONS = Object.freeze({
  default: 2000,
  banner: 3000,
});
const COPY_SUCCESS_FEEDBACK_HTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon-check"><polyline points="20 6 9 17 4 12"></polyline></svg> <span>Copied!</span>';

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
const copyBanner = document.getElementById('copy-banner');
const copyBannerButton = document.getElementById('copy-banner-button');
let copyBannerTimeoutId = null;

const getTextareaValue = () => {
  return textarea?.value;
}

const updateTextareaValue = (newValue) => {
  if (textarea && newValue !== undefined && newValue !== null) {
    textarea.value = newValue;
  }
  return getTextareaValue();
}


// Initial load from URL parameter
const initialText = getCurrentQueryParam(QUERY_PARAM_KEY);
if (initialText !== null) {
  const newTextAreaValue = decodeURIComponent(initialText);
  updateTextareaValue(newTextAreaValue);
  const newUrl = createUpdatedUrl(window.location.href, QUERY_PARAM_KEY, null);
  replaceUrl(newUrl);
}
const shouldShowCopyBanner = initialText !== null;

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

const generateQrCode = (size, sourceText) => {
  const url = createUpdatedUrl(window.location.href, QUERY_PARAM_KEY, sourceText);
  qrCodeImageContainer.innerHTML = '';
  new QRCode(qrCodeImageContainer, {
    text: url,
    width: size,
    height: size,
  });
};

const handleCopyError = (error) => {
  console.error('Failed to copy text: ', error);
};

const copyTextToClipboard = (text) => {
  return navigator.clipboard.writeText(text);
};

const clearCopyBannerTimeout = () => {
  if (!copyBannerTimeoutId) {
    return;
  }
  window.clearTimeout(copyBannerTimeoutId);
  copyBannerTimeoutId = null;
};

const hideCopyBanner = () => {
  if (!copyBanner) {
    return;
  }
  copyBanner.classList.remove('copy-banner--visible');
  copyBanner.setAttribute('aria-hidden', 'true');
  clearCopyBannerTimeout();
};

const showCopyBanner = () => {
  if (!copyBanner) {
    return;
  }
  copyBanner.classList.add('copy-banner--visible');
  copyBanner.setAttribute('aria-hidden', 'false');
  clearCopyBannerTimeout();
  copyBannerTimeoutId = window.setTimeout(() => {
    hideCopyBanner();
  }, COPY_BANNER_DISPLAY_DURATION);
};

const initializeCopyBanner = () => {
  if (!copyBanner || !copyBannerButton || !shouldShowCopyBanner) {
    return;
  }
  requestAnimationFrame(showCopyBanner);
};

// --- Event Handlers ---

const showTemporaryFeedback = (
  button,
  originalContent,
  feedbackHtml,
  onComplete = () => {},
  duration = COPY_FEEDBACK_DURATIONS.default,
) => {
  button.innerHTML = feedbackHtml;
  button.disabled = true;

  window.setTimeout(() => {
    button.innerHTML = originalContent;
    button.disabled = false;
    onComplete();
  }, duration);
};

const onCopyButtonClick = () => {
  if (!copyButton) {
    return;
  }
  const originalContent = copyButton.innerHTML;
  const inputText = getTextareaValue();
  inputText && copyTextToClipboard(inputText)
    .then(() => {
      showTemporaryFeedback(
        copyButton,
        originalContent,
        COPY_SUCCESS_FEEDBACK_HTML,
      );
    })
    .catch(handleCopyError);
};

const onCopyBannerButtonClick = () => {
  if (!copyBannerButton) {
    return;
  }
  clearCopyBannerTimeout();
  const originalContent = copyBannerButton.innerHTML;
  const inputText = getTextareaValue();
  inputText && copyTextToClipboard(inputText)
    .then(() => {
      showTemporaryFeedback(
        copyBannerButton,
        originalContent,
        COPY_SUCCESS_FEEDBACK_HTML,
        hideCopyBanner,
        COPY_FEEDBACK_DURATIONS.banner,
      );
    })
    .catch(handleCopyError);
};

const onCopyUrlButtonClick = () => {
  if (!copyUrlButton) {
    return;
  }
  const originalContent = copyUrlButton.innerHTML;
  const inputText = getTextareaValue();
  const urlToCopy = inputText && createUpdatedUrl(window.location.href, QUERY_PARAM_KEY, inputText);
  urlToCopy && copyTextToClipboard(urlToCopy)
    .then(() => {
      showTemporaryFeedback(
        copyUrlButton,
        originalContent,
        COPY_SUCCESS_FEEDBACK_HTML,
      );
    })
    .catch(handleCopyError);
};

const onGenerateQrButtonClick = () => {
  const inputText = getTextareaValue();
  generateQrCode(256, inputText);
  qrCodeContainer.style.display = 'block';
};

const onSaveFileButtonClick = () => {
  const inputText = getTextareaValue();
  const timestamp = createTimestamp();
  const filename = createFilename('note', timestamp, 'txt');
  const blob = new Blob([inputText], { type: 'text/plain' });
  triggerDownload(blob, filename);
};

const onCloseQrButtonClick = () => {
  qrCodeContainer.style.display = 'none';
};

const setButtonDisabledState = (button, shouldDisable) => {
  if (!button) {
    return;
  }
  button.disabled = shouldDisable;
};

const updateHeaderButtonState = Object.freeze({
  copyText: (inputTextLength) => {
    const isLengthValid = inputTextLength > 0;
    setButtonDisabledState(copyButton, !isLengthValid);
  },
  copyUrl: (inputTextLength) => {
    const isLengthValid = inputTextLength > 0 && inputTextLength <= MAX_TEXT_LENGTH_FOR_COPY_URL_BUTTON;
    setButtonDisabledState(copyUrlButton, !isLengthValid);
  },
  saveFile: (inputTextLength) => {
    const isLengthValid = inputTextLength > 0;
    setButtonDisabledState(saveFileButton, !isLengthValid);
  },
  qrCode: (inputTextLength) => {
    const isLengthValid = inputTextLength > 0 && inputTextLength <= MAX_TEXT_LENGTH_FOR_QR_CODE_BUTTON;
    setButtonDisabledState(generateQrButton, !isLengthValid);
  },
});

const onTextareaInput = () => {
  const inputText = getTextareaValue();
  const inputTextLength = inputText?.length ?? 0;
  updateHeaderButtonState.copyText(inputTextLength);
  updateHeaderButtonState.copyUrl(inputTextLength);
  updateHeaderButtonState.saveFile(inputTextLength);
  updateHeaderButtonState.qrCode(inputTextLength);
};

// --- Initializations ---

copyButton?.addEventListener('click', onCopyButtonClick);
copyUrlButton?.addEventListener('click', onCopyUrlButtonClick);
generateQrButton?.addEventListener('click', onGenerateQrButtonClick);
saveFileButton?.addEventListener('click', onSaveFileButtonClick);
closeQrButton?.addEventListener('click', onCloseQrButtonClick);
textarea?.addEventListener('input', onTextareaInput);
copyBannerButton?.addEventListener('click', onCopyBannerButtonClick);

qrCodeContainer.addEventListener('dragstart', (e) => e.preventDefault());

window.addEventListener('beforeunload', (e) => {
  const inputText = getTextareaValue();
  if (inputText) {
    e.preventDefault();
    e.returnValue = '';
  }
});

makeDraggable(qrCodeContainer);

initializeCopyBanner();
onTextareaInput(); // Initial check for all button states
