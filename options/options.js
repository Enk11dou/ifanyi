async function load() {
    const config = await chrome.storage.sync.get(['enabled', 'autoTranslateInput', 'autoTranslateOutput']);
    document.getElementById('enabled').checked = config.enabled !== false;
    document.getElementById('autoInput').checked = config.autoTranslateInput !== false;
    document.getElementById('autoOutput').checked = config.autoTranslateOutput !== false;
}

async function save() {
    await chrome.storage.sync.set({
        enabled: document.getElementById('enabled').checked,
        autoTranslateInput: document.getElementById('autoInput').checked,
        autoTranslateOutput: document.getElementById('autoOutput').checked
    });
    alert('设置已保存！');
}

document.addEventListener('DOMContentLoaded', load);
