const QUERY_PARAM_KEY = 't';

const getCurrentQueryParam = (key) => {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(key);
};

const createUpdatedUrl = (currentUrl, key, text) => {
  const url = new URL(currentUrl);
  if (text) {
    url.searchParams.set(key, text);
  } else {
    url.searchParams.delete(key);
  }
  return url.toString();
};

const replaceUrl = (newUrl) => {
  window.history.replaceState(null, '', newUrl);
};

const textarea = document.getElementById('main-textarea');

const initialText = getCurrentQueryParam(QUERY_PARAM_KEY);
if (initialText !== null) {
  textarea.value = decodeURIComponent(initialText);
}

const onTextareaInput = () => {
  const newUrl = createUpdatedUrl(window.location.href, QUERY_PARAM_KEY, textarea.value);
  replaceUrl(newUrl);
};

textarea.addEventListener('input', onTextareaInput);
