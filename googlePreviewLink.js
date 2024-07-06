// ==UserScript==
// @name         Enhanced Google Search Site Preview (Debug)
// @namespace    http://tampermonkey.net/
// @version      1.2
// @description  Show site preview on hover with debug logging
// @match        https://www.google.com/search*
// @grant        GM_addStyle
// @grant        GM_xmlhttpRequest
// @connect      *
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    console.log('Script starting...');

    GM_addStyle(`
        .site-preview-popup {
            position: fixed;
            z-index: 9999;
            border: none;
            box-shadow: 0 5px 15px rgba(0,0,0,0.3);
            display: none;
            width: 90vw;
            max-width: 600px;
            height: 80vh;
            max-height: 800px;
            background: white;
            border-radius: 10px;
            overflow: hidden;
        }
        .site-preview-iframe {
            width: 100%;
            height: 100%;
            border: none;
            overflow: auto;
        }
        .site-preview-loading {
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100%;
            font-style: italic;
            color: #666;
            background: #f5f5f5;
        }
        .site-preview-close {
            position: absolute;
            top: 10px;
            right: 10px;
            width: 30px;
            height: 30px;
            background: rgba(0,0,0,0.5);
            color: white;
            border: none;
            border-radius: 50%;
            font-size: 18px;
            cursor: pointer;
            display: flex;
            justify-content: center;
            align-items: center;
            transition: background 0.3s;
        }
        .site-preview-close:hover {
            background: rgba(0,0,0,0.7);
        }
    `);

    const preview = document.createElement('div');
    preview.className = 'site-preview-popup';
    document.body.appendChild(preview);

    console.log('Preview element created and added to body');

    let loadTimer;
    let closeTimer;

    function addEventListenersToLinks() {
        const links = document.querySelectorAll('a[href^="http"]');
        console.log(`Found ${links.length} links`);
        links.forEach(link => {
            link.addEventListener('mouseenter', showPreview);
            link.addEventListener('mouseleave', startCloseTimer);
        });
    }

    function showPreview(event) {
        console.log('showPreview called');
        clearTimeout(closeTimer);
        const link = event.target.closest('a');
        if (!link) return;

        const url = new URL(link.href);
        console.log(`Showing preview for: ${url.href}`);

        preview.innerHTML = `
            <button class="site-preview-close">&times;</button>
            <div class="site-preview-loading">Loading preview...</div>
        `;
        preview.querySelector('.site-preview-close').addEventListener('click', hidePreview);

        const mouseX = event.clientX;
        const mouseY = event.clientY;
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        const spaceBelow = viewportHeight - mouseY;
        const spaceAbove = mouseY;
        const popupHeight = Math.min(viewportHeight * 0.8, 800);

        let top, left;

        if (spaceBelow >= popupHeight || spaceBelow > spaceAbove) {
            top = mouseY + 10;
        } else {
            top = mouseY - popupHeight - 10;
        }

        left = Math.min(mouseX, viewportWidth - preview.offsetWidth);

        preview.style.top = `${top}px`;
        preview.style.left = `${left}px`;
        preview.style.display = 'block';

        loadTimer = setTimeout(() => loadWebsiteContent(url.href), 500);
    }

    function startCloseTimer() {
        console.log('startCloseTimer called');
        closeTimer = setTimeout(hidePreview, 5000);
    }

    function hidePreview() {
        console.log('hidePreview called');
        clearTimeout(loadTimer);
        preview.style.display = 'none';
    }

    function loadWebsiteContent(url) {
        console.log(`Loading content for: ${url}`);
        GM_xmlhttpRequest({
            method: 'GET',
            url: url,
            headers: {
                "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.5",
                "Upgrade-Insecure-Requests": "1",
                "Cache-Control": "max-age=0"
            },
            anonymous: true,
            onload: function(response) {
                console.log('Content loaded successfully');
                preview.innerHTML = '<button class="site-preview-close">&times;</button>';
                preview.querySelector('.site-preview-close').addEventListener('click', hidePreview);

                const iframe = document.createElement('iframe');
                iframe.className = 'site-preview-iframe';
                iframe.sandbox = 'allow-scripts allow-same-origin';
                preview.appendChild(iframe);

                const doc = iframe.contentDocument || iframe.contentWindow.document;
                doc.open();
                doc.write(response.responseText);
                doc.close();

                const style = doc.createElement('style');
                style.textContent = `
                    body { overflow: auto; }
                    ::-webkit-scrollbar { display: none; }
                    @media (max-width: 768px) {
                        body { zoom: 1.2; }
                    }
                `;
                doc.head.appendChild(style);

                const base = doc.createElement('base');
                base.href = url;
                doc.head.insertBefore(base, doc.head.firstChild);

                const elements = doc.querySelectorAll('[src], [href]');
                elements.forEach(el => {
                    if (el.src && !el.src.startsWith('http')) {
                        el.src = new URL(el.src, url).href;
                    }
                    if (el.href && !el.href.startsWith('http')) {
                        el.href = new URL(el.href, url).href;
                    }
                });
            },
            onerror: function() {
                console.error('Failed to load content');
                preview.innerHTML = '<p>Failed to load preview. The site may not allow embedding.</p>';
            }
        });
    }

    addEventListenersToLinks();

    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'childList') {
                console.log('DOM changed, re-adding event listeners');
                addEventListenersToLinks();
            }
        });
    });
    observer.observe(document.body, { childList: true, subtree: true });

    preview.addEventListener('mouseenter', () => {
        console.log('Mouse entered preview');
        clearTimeout(closeTimer);
    });
    preview.addEventListener('mouseleave', startCloseTimer);

    console.log('Script setup complete');
})();
