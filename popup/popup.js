const elements = {
    statusDot: document.getElementById('statusDot'),
    statusValue: document.getElementById('statusValue'),
    platformValue: document.getElementById('platformValue'),
    enableToggle: document.getElementById('enableToggle'),
    inputToggle: document.getElementById('inputToggle'),
    outputToggle: document.getElementById('outputToggle'),
    cacheSize: document.getElementById('cacheSize'),
    clearCacheBtn: document.getElementById('clearCacheBtn'),
    settingsBtn: document.getElementById('settingsBtn')
};

async function loadConfig() {
    const config = await chrome.storage.sync.get(['enabled', 'autoTranslateInput', 'autoTranslateOutput']);
    elements.enableToggle.checked = config.enabled !== false;
    elements.inputToggle.checked = config.autoTranslateInput !== false;
    elements.outputToggle.checked = config.autoTranslateOutput !== false;
}

async function updateStatus() {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab?.url) {
            setStatus('未知', 'inactive');
            return;
        }

        const supported = ['chat.openai.com', 'chatgpt.com', 'gemini.google.com', 'claude.ai'];
        const hostname = new URL(tab.url).hostname;

        if (!supported.some(s => hostname.includes(s))) {
            setStatus('不支持当前网站', 'inactive');
            elements.platformValue.textContent = hostname;
            return;
        }

        chrome.tabs.sendMessage(tab.id, { action: 'getStatus' }, (response) => {
            if (chrome.runtime.lastError) {
                setStatus('请刷新页面', 'inactive');
                return;
            }
            if (response) {
                setStatus(response.enabled ? '运行中' : '已暂停', response.enabled ? 'active' : 'inactive');
                elements.platformValue.textContent = response.platform || '未知';
                if (response.cacheStats) {
                    elements.cacheSize.textContent = response.cacheStats.size;
                }
            }
        });
    } catch (e) {
        setStatus('错误', 'inactive');
    }
}

function setStatus(text, status) {
    elements.statusValue.textContent = text;
    elements.statusDot.className = `status-dot ${status}`;
}

async function saveConfig(key, value) {
    await chrome.storage.sync.set({ [key]: value });
}

elements.enableToggle.addEventListener('change', async (e) => {
    await saveConfig('enabled', e.target.checked);
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) chrome.tabs.sendMessage(tab.id, { action: 'toggleEnabled', enabled: e.target.checked });
    updateStatus();
});

elements.inputToggle.addEventListener('change', (e) => saveConfig('autoTranslateInput', e.target.checked));
elements.outputToggle.addEventListener('change', (e) => saveConfig('autoTranslateOutput', e.target.checked));

elements.clearCacheBtn.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
        chrome.tabs.sendMessage(tab.id, { action: 'clearCache' }, (response) => {
            if (response?.success) elements.cacheSize.textContent = '0';
        });
    }
});

elements.settingsBtn.addEventListener('click', () => chrome.runtime.openOptionsPage());

document.addEventListener('DOMContentLoaded', async () => {
    await loadConfig();
    await updateStatus();
});
