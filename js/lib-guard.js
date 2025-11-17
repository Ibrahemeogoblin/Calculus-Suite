const libraryRetryState = {};
let libraryAlertNode = null;

function showLibraryAlert(missing) {
    if (libraryAlertNode) {
        libraryAlertNode.remove();
    }
    libraryAlertNode = document.createElement('div');
    libraryAlertNode.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);background:#ff3b30;color:white;padding:16px 24px;border-radius:12px;z-index:99999;font-family:system-ui;box-shadow:0 4px 20px rgba(0,0,0,0.3);';
    libraryAlertNode.innerHTML = `<strong>⚠️ Library Loading Error</strong><br>Failed to load: ${missing.join(', ')}<br><small>Please refresh the page or check your internet connection</small>`;
    (document.body || document.documentElement).appendChild(libraryAlertNode);
}

function dismissLibraryAlert() {
    if (libraryAlertNode) {
        libraryAlertNode.remove();
        libraryAlertNode = null;
    }
}

function validateLibraries(attempt = 0) {
    const libraries = {
        math: typeof math !== 'undefined',
        Plotly: typeof Plotly !== 'undefined',
        Algebrite: typeof Algebrite !== 'undefined'
    };

    const missing = Object.keys(libraries).filter(lib => !libraries[lib]);
    const pending = missing.filter(lib => libraryRetryState[lib]);

    if (pending.length > 0 && attempt < 6) {
        setTimeout(() => validateLibraries(attempt + 1), 500);
        return;
    }

    if (missing.length > 0) {
        console.error('Failed to load libraries:', missing);
        showLibraryAlert(missing);
    } else {
        dismissLibraryAlert();
        console.log('✓ All libraries loaded successfully');
    }
}

function handleLibraryFallback(scriptEl) {
    const fallback = scriptEl.getAttribute('data-fallback');
    const libName = scriptEl.getAttribute('data-library') || 'library';

    if (!fallback || scriptEl.dataset.retried === 'true') {
        console.error(`No fallback remaining for ${libName}`);
        showLibraryAlert([libName]);
        return;
    }

    scriptEl.dataset.retried = 'true';
    libraryRetryState[libName] = true;
    console.warn(`Primary CDN failed for ${libName}. Retrying with fallback.`);

    const replacement = document.createElement('script');
    replacement.src = fallback;
    replacement.setAttribute('data-library', libName);
    replacement.onload = () => {
        libraryRetryState[libName] = false;
        window.dispatchEvent(new CustomEvent('library-loaded', { detail: libName }));
    };
    replacement.onerror = () => {
        libraryRetryState[libName] = false;
        showLibraryAlert([libName]);
    };

    scriptEl.insertAdjacentElement('afterend', replacement);
    scriptEl.remove();
}

window.addEventListener('load', () => validateLibraries());
window.addEventListener('library-loaded', () => validateLibraries());

