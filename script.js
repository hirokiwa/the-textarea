const QUERY_PARAM_KEY = 't';
const ENCODING_QUERY_PARAM_KEY = 'e';
const GZIP_ENCODING_VALUE = 'g';
const MAX_TEXT_LENGTH_FOR_COPY_URL_BUTTON = 2000;
const MAX_TEXT_LENGTH_FOR_QR_CODE_BUTTON = 2000;
const COPY_BANNER_DISPLAY_DURATION = 5000;
const COPY_BANNER_INITIAL_DELAY = 500;
const COPY_FEEDBACK_DURATIONS = Object.freeze({
  default: 2000,
  banner: 3000,
});
const COPY_SUCCESS_FEEDBACK_HTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon-check"><polyline points="20 6 9 17 4 12"></polyline></svg> <span>Copied!</span>';

const getCurrentQueryParam = (key) => {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(key);
};

const createBinaryStringFromBytes = (bytes) => {
  return Array.from(bytes)
    .map((byte) => String.fromCharCode(byte))
    .join('');
};

const createBytesFromBinaryString = (binaryString) => {
  return Uint8Array.from(binaryString, (character) => character.charCodeAt(0));
};

const base64Url = {
  encode: (bytes) => {
    return btoa(createBinaryStringFromBytes(bytes))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  },
  decode: (base64UrlText) => {
    const paddingLength = (4 - (base64UrlText.length % 4)) % 4;
    const padding = '='.repeat(paddingLength);
    const base64Text = `${base64UrlText}${padding}`
      .replace(/-/g, '+')
      .replace(/_/g, '/');
    return createBytesFromBinaryString(atob(base64Text));
  },
};

const gzipCodec = {
  isSupported: () => {
    return typeof CompressionStream !== 'undefined' && typeof DecompressionStream !== 'undefined';
  },
  compress: async (text) => {
    const compressedStream = new Blob([text])
      .stream()
      .pipeThrough(new CompressionStream('gzip'));
    const compressedBuffer = await new Response(compressedStream).arrayBuffer();
    return new Uint8Array(compressedBuffer);
  },
  decompress: async (base64UrlText) => {
    const compressedBytes = base64Url.decode(base64UrlText);
    const decompressedStream = new Blob([compressedBytes])
      .stream()
      .pipeThrough(new DecompressionStream('gzip'));
    return new Response(decompressedStream).text();
  },
};

const textParameter = {
  createPlain: (text) => {
    return {
      encoding: null,
      text,
    };
  },
  createGzip: (text) => {
    return {
      encoding: GZIP_ENCODING_VALUE,
      text,
    };
  },
  isCompressedShorter: (compressedText, originalText) => {
    return compressedText.length < encodeURIComponent(originalText).length;
  },
  create: async (text) => {
    if (!gzipCodec.isSupported()) {
      return textParameter.createPlain(text);
    }

    const compressedBytes = await gzipCodec.compress(text).catch(() => null);
    if (!compressedBytes) {
      return textParameter.createPlain(text);
    }

    const compressedText = base64Url.encode(compressedBytes);
    return textParameter.isCompressedShorter(compressedText, text)
      ? textParameter.createGzip(compressedText)
      : textParameter.createPlain(text);
  },
  decode: async (parameter) => {
    if (parameter.encoding !== GZIP_ENCODING_VALUE) {
      return parameter.text;
    }
    return gzipCodec.decompress(parameter.text);
  },
  fromUrl: (key) => {
    const text = getCurrentQueryParam(key);
    if (text === null) {
      return null;
    }

    return {
      encoding: getCurrentQueryParam(ENCODING_QUERY_PARAM_KEY),
      text,
    };
  },
};

const urlTextParameter = {
  remove: (url, key) => {
    url.searchParams.delete(key);
    url.searchParams.delete(ENCODING_QUERY_PARAM_KEY);
  },
  apply: (url, key, parameter) => {
    if (parameter.encoding) {
      url.searchParams.set(ENCODING_QUERY_PARAM_KEY, parameter.encoding);
    }
    url.searchParams.set(key, parameter.text);
  },
  update: async (url, key, text) => {
    urlTextParameter.remove(url, key);

    if (!text) {
      return url;
    }

    urlTextParameter.apply(url, key, await textParameter.create(text));
    return url;
  },
};

const createUpdatedUrl = async (currentUrl, key, text) => {
  const url = await urlTextParameter.update(new URL(currentUrl), key, text);
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


const restoreTextareaValueFromUrl = async () => {
  const parameter = textParameter.fromUrl(QUERY_PARAM_KEY);
  if (!parameter) {
    return false;
  }

  const newTextAreaValue = await textParameter.decode(parameter);
  updateTextareaValue(newTextAreaValue);
  const newUrl = await createUpdatedUrl(window.location.href, QUERY_PARAM_KEY, null);
  replaceUrl(newUrl);
  return true;
};

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

const generateQrCode = async (size, sourceText) => {
  const url = await createUpdatedUrl(window.location.href, QUERY_PARAM_KEY, sourceText);
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

const initializeCopyBanner = (shouldShowCopyBanner) => {
  if (!copyBanner || !copyBannerButton || !shouldShowCopyBanner) {
    return;
  }
  window.setTimeout(() => {
    showCopyBanner();
  }, COPY_BANNER_INITIAL_DELAY);
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
  inputText && createUpdatedUrl(window.location.href, QUERY_PARAM_KEY, inputText)
    .then(copyTextToClipboard)
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
  inputText && generateQrCode(256, inputText)
    .then(() => {
      qrCodeContainer.style.display = 'block';
    })
    .catch(handleCopyError);
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

const DEFAULT_TITLE = 'The Textarea';
const TITLE_MAX_LENGTH = 30;

const extractTitleFromText = (text) => {
  if (!text || text.length === 0) {
    return DEFAULT_TITLE;
  }
  return text
    .replace(/^[\s　]+/, '')  // Remove all leading half-width and full-width spaces
    .replace(/\r?\n/g, '')    // Remove all line breaks
    .slice(0, TITLE_MAX_LENGTH);
};

const shouldUpdateTitle = (previousTitleSource, nextTitleSource) => {
  return previousTitleSource !== nextTitleSource;
};

const applyDocumentTitle = (title) => {
  document.title = title;
};

const createTextareaTitleSync = () => {
  const initialText = getTextareaValue() ?? '';
  const initialTitleSource = extractTitleFromText(initialText);

  applyDocumentTitle(initialTitleSource);

  let previousTitleSource = initialTitleSource;

  const handleChange = () => {
    const currentText = getTextareaValue() ?? '';
    const nextTitleSource = extractTitleFromText(currentText);

    if (!shouldUpdateTitle(previousTitleSource, nextTitleSource)) {
      return;
    }

    applyDocumentTitle(nextTitleSource);
    previousTitleSource = nextTitleSource;
  };

  return Object.freeze({
    handleChange,
  });
};

const textareaTitleSync = createTextareaTitleSync();

// --- Initializations ---

copyButton?.addEventListener('click', onCopyButtonClick);
copyUrlButton?.addEventListener('click', onCopyUrlButtonClick);
generateQrButton?.addEventListener('click', onGenerateQrButtonClick);
saveFileButton?.addEventListener('click', onSaveFileButtonClick);
closeQrButton?.addEventListener('click', onCloseQrButtonClick);
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

// ここを「input」に変更してリアルタイム更新
const onTextareaInput = () => {
  const inputText = getTextareaValue();
  const inputTextLength = inputText?.length ?? 0;

  updateHeaderButtonState.copyText(inputTextLength);
  updateHeaderButtonState.copyUrl(inputTextLength);
  updateHeaderButtonState.saveFile(inputTextLength);
  updateHeaderButtonState.qrCode(inputTextLength);

  textareaTitleSync.handleChange();
};

textarea?.addEventListener('input', onTextareaInput);
copyBannerButton?.addEventListener('click', onCopyBannerButtonClick);

qrCodeContainer.addEventListener('dragstart', (e) => e.preventDefault());

const initializeApplication = async () => {
  const shouldShowCopyBanner = await restoreTextareaValueFromUrl();
  onTextareaInput();
  initializeCopyBanner(shouldShowCopyBanner);
};

initializeApplication().catch(handleCopyError);
