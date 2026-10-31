/*!
 * Kayan Plus — main.js
 * Progressive enhancement only: every section is readable without JavaScript.
 */
(() => {
    'use strict';

    const $ = (sel, ctx = document) => ctx.querySelector(sel);
    const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const hasIO = 'IntersectionObserver' in window;

    const root = document.documentElement;
    const WHATSAPP_NUMBER = '201033006690';
    // End of the exceptional "توفيق الأوضاع" period, set once on <html>.
    const CAMPAIGN_DEADLINE = Date.parse(root.dataset.campaignEnd);

    /* ------------------------------------------------------------------ Reveal on scroll */
    // Runs first: until it does, the .reveal sections are invisible.
    const revealEls = $$('.reveal');
    // Once an element has entered, drop the helper classes so its own hover
    // transitions (lift, glow) work without the entrance delay.
    const settle = (el) => el.classList.remove('reveal', 'is-in');
    if (hasIO && !reduceMotion) {
        const revealer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                const el = entry.target;
                revealer.unobserve(el);
                el.classList.add('is-in');
                const onEnd = (e) => {
                    if (e.target !== el) return;
                    el.removeEventListener('transitionend', onEnd);
                    settle(el);
                };
                el.addEventListener('transitionend', onEnd);
                setTimeout(() => settle(el), 1800);
            });
        }, { rootMargin: '0px 0px -8% 0px', threshold: 0.1 });
        revealEls.forEach((el) => revealer.observe(el));
    } else {
        revealEls.forEach(settle);
    }
    // Tells the inline fallback in <head> that the reveal is in place.
    root.setAttribute('data-ready', '');

    const openDialog = (dialog) => {
        if (typeof dialog.showModal === 'function') dialog.showModal();
        else dialog.setAttribute('open', '');
    };
    const closeDialog = (dialog) => {
        if (typeof dialog.close === 'function') dialog.close();
        else dialog.removeAttribute('open');
    };

    /* ------------------------------------------------------------------ Header & back-to-top */
    const header = $('#siteHeader');
    const toTop = $('#toTop');
    let isScrolled = null;
    let showTop = null;
    let ticking = false;

    const onScroll = () => {
        ticking = false;
        const y = window.scrollY;
        if ((y > 40) !== isScrolled) {
            isScrolled = y > 40;
            header.classList.toggle('is-scrolled', isScrolled);
        }
        if ((y > 900) !== showTop) {
            showTop = y > 900;
            toTop.classList.toggle('is-visible', showTop);
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
    toTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' }));

    /* ------------------------------------------------------------------ Active section in the nav */
    const navLinks = $$('.nav-links a[href^="#"]');
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

    const steps = $('#steps');
    if (steps) {
        if (hasIO && !reduceMotion) {
            const drawer = new IntersectionObserver((entries) => {
                if (!entries.some((entry) => entry.isIntersecting)) return;
                steps.classList.add('is-drawn');
                drawer.disconnect();
            }, { threshold: 0.35 });
            drawer.observe(steps);
        } else {
            steps.classList.add('is-drawn');
        }
    }

    /* ------------------------------------------------------------------ Count-up stats */
    if (hasIO && !reduceMotion) {
        const countUp = (el) => {
            const target = Number(el.dataset.count);
            const start = performance.now();
            const frame = (now) => {
                const p = Math.min(1, (now - start) / 1400);
                el.textContent = String(Math.round(target * (1 - Math.pow(1 - p, 3))));
                if (p < 1) requestAnimationFrame(frame);
            };
            requestAnimationFrame(frame);
        };
        // Stats already on screen at load keep their final value (resetting
        // them to 0 would flash). Off-screen ones drop to 0 and count up later.
        const armed = new WeakSet();
        const counter = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                const el = entry.target;
                if (armed.has(el)) {
                    if (entry.intersectionRatio < 0.6) return;
                    counter.unobserve(el);
                    countUp(el);
                } else if (!entry.isIntersecting) {
                    armed.add(el);
                    el.textContent = '0';
                } else {
                    counter.unobserve(el);
                }
            });
        }, { threshold: [0, 0.6] });
        $$('[data-count]').forEach((el) => counter.observe(el));
    }

    /* ------------------------------------------------------------------ Campaign countdown */
    const cd = { d: $('[data-cd="d"]'), h: $('[data-cd="h"]'), m: $('[data-cd="m"]'), s: $('[data-cd="s"]') };
    const daysLeftEls = $$('[data-days-left]');
    const pad = (n) => String(n).padStart(2, '0');
    let countdownTimer = 0;
    let lastDays = -1;

    // Same class the inline <head> script sets when the page loads after the
    // deadline: hides [data-campaign] and the header's room for the topbar.
    const endCampaign = () => {
        clearInterval(countdownTimer);
        root.classList.add('campaign-over');
    };
    const tick = () => {
        const left = CAMPAIGN_DEADLINE - Date.now();
        if (left <= 0) {
            endCampaign();
            return;
        }
        const total = Math.floor(left / 1000);
        const days = Math.floor(total / 86400);
        if (cd.d) {
            cd.d.textContent = String(days);
            cd.h.textContent = pad(Math.floor((total % 86400) / 3600));
            cd.m.textContent = pad(Math.floor((total % 3600) / 60));
            cd.s.textContent = pad(total % 60);
        }
        if (days !== lastDays) {
            lastDays = days;
            daysLeftEls.forEach((el) => { el.textContent = String(days); });
        }
    };
    tick();
    if (CAMPAIGN_DEADLINE > Date.now()) countdownTimer = setInterval(tick, 1000);

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
    // Transparent 1x1 GIF: an empty box (ivory background + spinner) while a scan loads.
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
