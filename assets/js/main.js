/*!
 * Kayan Plus — main.js
 * Progressive enhancement only: every section is readable without JavaScript.
 */
(() => {
    'use strict';

    const $ = (sel, ctx = document) => ctx.querySelector(sel);
    const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
    const hasIO = 'IntersectionObserver' in window;

    const root = document.documentElement;
    const WHATSAPP_NUMBER = '201033006690';
    // End of the exceptional "توفيق الأوضاع" period, set once on <html>.
    const CAMPAIGN_DEADLINE = Date.parse(root.dataset.campaignEnd);

    const openDialog = (dialog) => {
        if (typeof dialog.showModal === 'function') dialog.showModal();
        else dialog.setAttribute('open', '');
    };
    const closeDialog = (dialog) => {
        if (typeof dialog.close === 'function') dialog.close();
        else dialog.removeAttribute('open');
    };

    /* ------------------------------------------------------------------ Header hairline on scroll */
    const header = $('#siteHeader');
    let isScrolled = null;
    let ticking = false;
    const onScroll = () => {
        ticking = false;
        const scrolled = window.scrollY > 8;
        if (scrolled !== isScrolled) {
            isScrolled = scrolled;
            header.classList.toggle('is-scrolled', scrolled);
        }
    };
    window.addEventListener('scroll', () => {
        if (!ticking) {
            ticking = true;
            requestAnimationFrame(onScroll);
        }
    }, { passive: true });
    // First check on the next frame: reading scrollY now would force a
    // synchronous layout of the whole page while it is still loading.
    requestAnimationFrame(onScroll);

    /* ------------------------------------------------------------------ Active section in the nav */
    const navLinks = $$('.hdr-nav a[href^="#"]');
    if (hasIO && navLinks.length) {
        const linkFor = new Map(navLinks.map((a) => [a.hash.slice(1), a]));
        const spy = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                navLinks.forEach((a) => a.removeAttribute('aria-current'));
                const link = linkFor.get(entry.target.id);
                if (link) link.setAttribute('aria-current', 'true');
            });
        }, { rootMargin: '-45% 0px -50% 0px' });
        $$('main > section[id]').forEach((section) => spy.observe(section));
    }

    /* ------------------------------------------------------------------ Mobile menu */
    const menu = $('#mobileMenu');
    const burger = $('#burger');
    burger.addEventListener('click', () => {
        openDialog(menu);
        burger.setAttribute('aria-expanded', 'true');
    });
    menu.addEventListener('click', (e) => {
        // Close first, then let the browser follow the in-page link.
        if (e.target.closest('a, [data-close-menu]')) {
            closeDialog(menu);
            burger.setAttribute('aria-expanded', 'false');
        }
    });
    menu.addEventListener('close', () => burger.setAttribute('aria-expanded', 'false'));

    /* ------------------------------------------------------------------ Campaign: days left */
    // Arabic counted noun: 11+ → يوماً, 3–10 → أيام, 2 → يومان, 1 → يوم واحد.
    const daysPhrase = (n) => {
        if (n >= 11) return `${n} يوماً`;
        if (n >= 3) return `${n} أيام`;
        if (n === 2) return 'يومان';
        if (n === 1) return 'يوم واحد';
        return 'ساعات';
    };
    const dayCounts = $$('[data-days-left]');
    const dayPhrases = $$('[data-days-phrase]');
    let campaignTimer = 0;
    // Same class the inline <head> script sets when the page loads after the
    // deadline: hides every [data-campaign] block.
    const updateCampaign = () => {
        const left = CAMPAIGN_DEADLINE - Date.now();
        if (!(left > 0)) {
            clearInterval(campaignTimer);
            root.classList.add('campaign-over');
            return;
        }
        const days = Math.floor(left / 86400000);
        dayCounts.forEach((el) => { el.textContent = String(days); });
        dayPhrases.forEach((el) => { el.textContent = daysPhrase(days); });
    };
    updateCampaign();
    if (CAMPAIGN_DEADLINE > Date.now()) campaignTimer = setInterval(updateCampaign, 60000);

    /* ------------------------------------------------------------------ Work filter */
    const docsList = $('#docs');
    const docs = $$('.doc', docsList);
    const filters = $$('.filter');
    filters.forEach((btn) => {
        btn.addEventListener('click', () => {
            const type = btn.dataset.filter;
            filters.forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
            docs.forEach((doc) => { doc.hidden = type !== 'all' && doc.dataset.type !== type; });
            docsList.scrollLeft = 0;
        });
    });

    /* ------------------------------------------------------------------ Document viewer */
    const lb = $('#lightbox');
    const stage = $('#lbStage');
    const lbImg = $('#lbImg');
    const lbTitle = $('#lbTitle');
    const lbMeta = $('#lbMeta');
    const lbCount = $('#lbCount');
    const lbFull = $('#lbFull');
    let viewing = [];
    let index = 0;
    // Transparent 1x1 GIF: an empty box (white background + spinner) while a scan loads.
    const BLANK = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

    // Size the image box from the scan's real dimensions so the blurred
    // thumbnail placeholder and the sharp scan occupy exactly the same space.
    const fit = () => {
        const btn = viewing[index] && $('.doc-open', viewing[index]);
        if (!btn) return;
        const w = Number(btn.dataset.w);
        const h = Number(btn.dataset.h);
        const cs = getComputedStyle(stage);
        const availW = stage.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
        const availH = stage.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
        const scale = Math.min(availW / w, availH / h, 1.25);
        lbImg.style.width = `${Math.floor(w * scale)}px`;
        lbImg.style.height = `${Math.floor(h * scale)}px`;
    };

    const showDoc = (i) => {
        index = (i + viewing.length) % viewing.length;
        const doc = viewing[index];
        const btn = $('.doc-open', doc);
        const thumb = $('img', btn);
        const fullSrc = btn.dataset.full;

        lbTitle.textContent = $('h3', doc).textContent;
        lbMeta.textContent = `${$('.doc-type', doc).textContent} · ${$('h3 + p', doc).textContent}`;
        lbCount.textContent = `${index + 1} / ${viewing.length}`;
        lbFull.href = fullSrc;
        lbImg.alt = thumb.alt;
        fit();

        lb.classList.add('is-loading');
        // The card thumbnail doubles as a blurred placeholder, unless it is a
        // crop of the page (landscape scans get a portrait card) and would jump.
        const thumbRatio = Number(thumb.getAttribute('width')) / Number(thumb.getAttribute('height'));
        const sameShape = Math.abs(thumbRatio - Number(btn.dataset.w) / Number(btn.dataset.h)) < 0.05;
        lbImg.src = sameShape ? (thumb.currentSrc || thumb.src) : BLANK;
        const sharp = new Image();
        sharp.onload = () => {
            if (viewing[index] !== doc) return;
            lbImg.src = fullSrc;
            lb.classList.remove('is-loading');
            // Warm up the next scan so paging feels instant.
            const next = viewing[(index + 1) % viewing.length];
            if (next !== doc) new Image().src = $('.doc-open', next).dataset.full;
        };
        sharp.onerror = () => {
            if (viewing[index] === doc) lb.classList.remove('is-loading');
        };
        sharp.src = fullSrc;
    };
    // Paging is a no-op when only one document is in view (e.g. a filter).
    const step = (delta) => {
        if (viewing.length > 1) showDoc(index + delta);
    };

    docsList.addEventListener('click', (e) => {
        const btn = e.target.closest('.doc-open');
        if (!btn) return;
        viewing = docs.filter((doc) => !doc.hidden);
        lb.classList.toggle('is-single', viewing.length < 2);
        openDialog(lb);
        showDoc(viewing.indexOf(btn.closest('.doc')));
    });

    lb.addEventListener('click', (e) => {
        const stepBtn = e.target.closest('[data-step]');
        if (stepBtn) {
            step(Number(stepBtn.dataset.step));
        } else if (e.target.closest('[data-close-lb]') || e.target === stage || e.target === lb) {
            closeDialog(lb);
        }
    });

    // RTL: the next document sits to the left.
    lb.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft') {
            e.preventDefault();
            step(1);
        } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            step(-1);
        }
    });

    // Swipe to page — but not while pinch-zoomed into a scan: then a sideways
    // drag must pan the page (.is-zoomed hands touch-action back to the browser).
    const vv = window.visualViewport;
    const zoomed = () => Boolean(vv) && vv.scale > 1.01;
    if (vv) vv.addEventListener('resize', () => stage.classList.toggle('is-zoomed', zoomed()));
    let swipeX = 0;
    let swipeY = 0;
    let swiping = false;
    stage.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'mouse') return;
        // A second finger means a pinch, not a swipe.
        swiping = e.isPrimary && !zoomed();
        swipeX = e.clientX;
        swipeY = e.clientY;
    });
    stage.addEventListener('pointerup', (e) => {
        if (!swiping) return;
        swiping = false;
        if (zoomed()) return;
        const dx = e.clientX - swipeX;
        const dy = e.clientY - swipeY;
        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) step(dx > 0 ? 1 : -1);
    });
    stage.addEventListener('pointercancel', () => { swiping = false; });
    window.addEventListener('resize', () => { if (lb.open) fit(); });

    /* ------------------------------------------------------------------ Lead form → WhatsApp */
    const form = $('#leadForm');
    if (form) {
        const nameField = form.elements.name;
        nameField.addEventListener('input', () => nameField.setCustomValidity(''));
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const name = nameField.value.trim();
            if (!name) {
                nameField.setCustomValidity('من فضلك اكتب الاسم أو اسم المنشأة');
                nameField.reportValidity();
                return;
            }
            const data = new FormData(form);
            const lines = [
                'مرحباً كيان بلس، أريد طلب استشارة مجانية.',
                `الاسم: ${name}`,
                `الخدمة المطلوبة: ${data.get('service')}`,
                `المنطقة الصناعية: ${data.get('area')}`,
            ];
            const notes = String(data.get('notes') || '').trim();
            if (notes) lines.push(`التفاصيل: ${notes}`);
            const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(lines.join('\n'))}`;
            // In-app browsers (Facebook, Instagram) often block new windows:
            // fall back to the same tab so the request is never lost.
            const win = window.open(url, '_blank');
            if (win) win.opener = null;
            else window.location.href = url;
        });
    }

    /* ------------------------------------------------------------------ Footer year */
    $$('[data-year]').forEach((el) => { el.textContent = String(new Date().getFullYear()); });
})();
