/**
 * Background Service Worker
 * 执行翻译请求（避免CSP问题）
 */
console.log('🚀 AI 双语助手后台服务启动');

chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
        chrome.storage.sync.set({
            enabled: true,
            autoTranslateInput: true
        });
    }
});

/**
 * Google翻译API请求
 */
async function googleTranslate(text, from, to) {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${from}&tl=${to}&dt=t&q=${encodeURIComponent(text)}`;

    console.log('后台翻译请求:', text.slice(0, 30), from, '->', to);

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        if (data && data[0]) {
            const result = data[0].map(item => item[0]).filter(Boolean).join('');
            console.log('后台翻译结果:', result.slice(0, 30));
            return result;
        }
        throw new Error('格式错误');
    } catch (error) {
        console.error('后台翻译失败:', error);
        throw error;
    }
}

// 监听来自content script的翻译请求
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'translate') {
        const { text, from, to } = request;

        googleTranslate(text, from, to)
            .then(result => sendResponse({ success: true, result }))
            .catch(error => sendResponse({ success: false, error: error.message }));

        return true; // 保持消息通道开放
    }

    return false;
});
