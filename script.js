let hymns = [];
let currentHymn = null;
let slideIdx = 0;
let autoTimer = null;
let isAuto = false;
let presentationSequence = []; 

// 1. INITIAL LOAD
fetch('hymns.json')
    .then(res => res.json())
    .then(data => { hymns = data; });

// 2. SEARCH LOGIC
function search(query) {
    const box = document.getElementById('dropdown');
    if (!query.trim()) { box.style.display = 'none'; return; }
    
    const q = query.toLowerCase();
    const isNum = !isNaN(q);

    let filtered = hymns.filter(h => {
        if (isNum) return h.number.toString().startsWith(q);
        const titleMatch = h.title.toLowerCase().includes(q);
        const lyricMatch = h.verses.some(v => v.lines.some(l => l.toLowerCase().includes(q)));
        return titleMatch || lyricMatch;
    });

    filtered.sort((a, b) => {
        if (isNum) {
            const aS = a.number.toString();
            const bS = b.number.toString();
            return aS.length - bS.length || a.number - b.number;
        }
        return a.title.toLowerCase().localeCompare(b.title.toLowerCase());
    });

    renderDropdown(filtered.slice(0, 15));
}

function renderDropdown(list) {
    const box = document.getElementById('dropdown');
    box.innerHTML = list.map(h => `
        <div class="dropdown-item" onclick='viewHymn(${h.number})'>
            <span><strong>${h.number}</strong>. ${h.title}</span>
        </div>
    `).join('');
    box.style.display = list.length ? 'block' : 'none';
}

// 3. HYMN VIEW & MULTI-PART SPLITTING
function viewHymn(num) {
    currentHymn = hymns.find(h => h.number === num);
    document.getElementById('dropdown').style.display = 'none';
    document.getElementById('searchBar').value = '';

    const welcome = document.getElementById('welcomeCard');
    if (welcome) welcome.style.display = 'none';

    const main = document.getElementById('content');
    const refrain = currentHymn.verses.find(v => v.type === 'refrain');
    
    presentationSequence = [];
    
    // Add title slide as first slide
    presentationSequence.push({
        type: 'title',
        lines: [currentHymn.title],
        number: currentHymn.number
    });
    
    let htmlContent = `
        <div class="hymn-card">
            <div class="btn-row">
                <button class="btn-manual" onclick="startPresent(false)">Manual Presentation</button>
                <button class="btn-cast" onclick="openCastMenu()" title="Cast to TV">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M2 16.1A5 5 0 0 1 5.9 20M2 12.05A9 9 0 0 1 9.95 20M2 8V6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-6"></path>
                        <line x1="2" y1="20" x2="2.01" y2="20"></line>
                    </svg>
                    Cast
                </button>
                <button class="btn-auto" onclick="startPresent(true)">Auto Presentation</button>
            </div>
            <h1>${currentHymn.number}. ${currentHymn.title}</h1>
    `;

    // Get max lines per slide based on current size setting
    const currentSize = SIZES.find(s => s.id === settings.sizeId) || SIZES[1];
    const MAX_LINES_PER_SLIDE = currentSize.maxLines;

    currentHymn.verses.forEach((v) => {
        // Display verse in hymn card
        htmlContent += `
            <div class="verse ${v.type === 'refrain' ? 'refrain' : ''}">
                ${v.number ? `<strong>${v.number}.</strong> ` : ''}${v.lines.join('<br>')}
            </div>`;
        
        // If this is a verse and there's a refrain, show refrain after it in hymn card
        if (v.type === 'verse' && refrain) {
            const currentIndex = currentHymn.verses.indexOf(v);
            const nextVerse = currentHymn.verses[currentIndex + 1];
            // Only add refrain if next item isn't already a refrain
            if (!nextVerse || nextVerse.type !== 'refrain') {
                htmlContent += `
                    <div class="verse refrain">
                        ${refrain.lines.join('<br>')}
                    </div>`;
            }
        }
        
        // Build presentation sequence with intelligent splitting
        let tempLines = [...v.lines];
        
        if (tempLines.length > MAX_LINES_PER_SLIDE) {
            // Split into multiple slides
            while (tempLines.length > 0) {
                const chunk = tempLines.splice(0, MAX_LINES_PER_SLIDE);
                presentationSequence.push({ 
                    ...v, 
                    lines: chunk
                });
            }
        } else {
            // Entire verse fits in one slide
            presentationSequence.push(v);
        }

        // Add refrain to presentation sequence after verses
        if (v.type === 'verse' && refrain) {
            const currentIndex = currentHymn.verses.indexOf(v);
            const nextVerse = currentHymn.verses[currentIndex + 1];
            if (!nextVerse || nextVerse.type !== 'refrain') {
                presentationSequence.push(refrain);
            }
        }
    });

    htmlContent += `</div>`;
    main.innerHTML = htmlContent;
    main.scrollTop = 0;

    const paddedNum = currentHymn.number.toString().padStart(3, '0');
    midiLoad(`midi/${paddedNum}.mid`);
    updateNavButtons();
}

// 4. PRESENTATION LOGIC
function startPresent(auto) {
    if (!currentHymn) return;
    isAuto = auto;
    slideIdx = 0;
    const presenter = document.getElementById('presenter');
    
    // Lock to landscape orientation on mobile
    if (screen.orientation && screen.orientation.lock) {
        screen.orientation.lock('landscape').catch(err => {
            console.log('Orientation lock not supported:', err);
        });
    }
    
    if (presenter.requestFullscreen) presenter.requestFullscreen();
    else if (presenter.webkitRequestFullscreen) presenter.webkitRequestFullscreen();

    presenter.style.display = 'flex';
    
    if (isAuto) {
        midiPlay();
        
        clearInterval(autoTimer);
        autoTimer = setInterval(() => {
            // Auto presentation disabled until timestamps are added
        }, 100);
    }
    updateSlide();
}

function updateSlide() {
    const el = document.getElementById('presentContent');
    const slide = presentationSequence[slideIdx];
    el.style.opacity = 0;
    el.style.transform = 'translateY(8px)';

    setTimeout(() => {
        if(slide) {
            let label = "";
            let content = "";
            
            if (slide.type === 'title') {
                // Title slide - use title font, no number
                el.innerHTML = `<div class="title-slide">${slide.lines[0]}</div>`;
            } else {
                // Regular verse/refrain slide - simple centered label at top
                if (slide.type === 'refrain') {
                    label = "<div class='slide-label'>Refrain</div>";
                } else if (slide.number) {
                    label = `<div class='slide-label'>${slide.number}</div>`;
                }
                
                el.innerHTML = `${label}<div class='slide-lyrics'>${slide.lines.join('<br>')}</div>`;
            }
            
            adjustFontSize();
            el.style.opacity = 1;
            el.style.transform = 'translateY(0)';
        }
    }, 250);
}

function adjustFontSize() {
    const container = document.getElementById('presenter');
    const textEl = document.getElementById('presentContent');
    const slide = presentationSequence[slideIdx];
    
    if (slide && slide.type === 'title') {
        // Title slide: fixed large size, shrink only if overflow
        let fontSize = 20; // Fixed 12vh for title
        textEl.style.fontSize = fontSize + "vh";
        
        while (
            (textEl.scrollHeight > container.clientHeight * 0.80 || 
             textEl.scrollWidth > container.clientWidth * 0.90) && 
            fontSize > 6
        ) {
            fontSize -= 0.5;
            textEl.style.fontSize = fontSize + "vh";
        }
    } else {
        // Lyrics slides: use user's chosen size, never auto-shrink
        const baseSizeVh = parseFloat(getComputedStyle(document.documentElement)
            .getPropertyValue('--present-font-size')) || 6;
        textEl.style.fontSize = baseSizeVh + "vh";
    }
}

function navigate(dir) {
    slideIdx += dir;
    if (slideIdx < 0) slideIdx = 0;
    else if (slideIdx >= presentationSequence.length) exitPresent();
    else updateSlide();
}

function exitPresent() {
    if (document.fullscreenElement) document.exitFullscreen();
    document.getElementById('presenter').style.display = 'none';
    midiStop();
    clearInterval(autoTimer);
    
    // Unlock orientation
    if (screen.orientation && screen.orientation.unlock) {
        screen.orientation.unlock();
    }
}

// 5. EVENT LISTENERS
document.addEventListener('keydown', (e) => {
    if (document.getElementById('presenter').style.display === 'flex') {
        if (e.key === "ArrowRight" || e.key === " ") navigate(1);
        if (e.key === "ArrowLeft") navigate(-1);
        if (e.key === "Escape") exitPresent();
    }
});

document.getElementById('presenter').addEventListener('click', (e) => {
    if (isAuto || e.target.className === 'close-x') return;
    if (e.clientX > window.innerWidth / 2) navigate(1);
    else navigate(-1);
});

document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement) exitPresent();
});


// ============================================================
// 6. SETTINGS PANEL
// ============================================================

const THEMES = [
    { id: 'ivory-onyx',    name: 'Ivory & Onyx',      bg: '#F5F0E8', text: '#1A1A1A', desc: 'Warm parchment, deep black' },
    { id: 'midnight-gold', name: 'Midnight & Gold',   bg: '#0D1B2A', text: '#E8D5A3', desc: 'Deep navy, warm gold' },
    { id: 'slate-cream',   name: 'Slate & Cream',     bg: '#2E3440', text: '#ECEFF4', desc: 'Cool slate, soft cream' },
    { id: 'forest-linen',  name: 'Forest & Linen',    bg: '#1C2B1E', text: '#F0EAD6', desc: 'Deep forest, linen white' },
    { id: 'dusk-pearl',    name: 'Dusk & Pearl',      bg: '#3B2F4A', text: '#F5F0FA', desc: 'Twilight purple, pearl' },
    { id: 'sepia-brown',   name: 'Sepia & Umber',     bg: '#F2E8D5', text: '#3D2B1F', desc: 'Aged paper, rich umber' },
    { id: 'cloud-charcoal',name: 'Cloud & Charcoal',  bg: '#EEF0F2', text: '#2B2D30', desc: 'Clean cloud, charcoal' },
    { id: 'ember-night',   name: 'Ember & Night',     bg: '#1A0F0A', text: '#F0C98F', desc: 'Dark night, warm amber' },
];

const TITLE_FONTS = [
    { id: 'tangerine',       name: 'Tangerine',        family: "'Tangerine', cursive",         sample: 'Amazing Grace' },
    { id: 'great-vibes',     name: 'Great Vibes',      family: "'Great Vibes', cursive",       sample: 'Amazing Grace' },
    { id: 'dancing-script',  name: 'Dancing Script',   family: "'Dancing Script', cursive",    sample: 'Amazing Grace' },
    { id: 'parisienne',      name: 'Parisienne',       family: "'Parisienne', cursive",        sample: 'Amazing Grace' },
    { id: 'allura',          name: 'Allura',           family: "'Allura', cursive",            sample: 'Amazing Grace' },
    { id: 'sacramento',      name: 'Sacramento',       family: "'Sacramento', cursive",        sample: 'Amazing Grace' },
];

const LYRICS_FONTS = [
    { id: 'cormorant',   name: 'Cormorant Garamond', family: "'Cormorant Garamond', serif",  sample: 'How sweet the sound' },
    { id: 'eb-garamond', name: 'EB Garamond',        family: "'EB Garamond', serif",          sample: 'How sweet the sound' },
    { id: 'lora',        name: 'Lora',               family: "'Lora', serif",                 sample: 'How sweet the sound' },
    { id: 'crimson-pro', name: 'Crimson Pro',        family: "'Crimson Pro', serif",          sample: 'How sweet the sound' },
    { id: 'libre-bask',  name: 'Libre Baskerville',  family: "'Libre Baskerville', serif",    sample: 'How sweet the sound' },
];

const SIZES = [
    { id: 'small',   name: 'Small',   vh: 4.5, maxLines: 6, desc: 'Entire verse' },
    { id: 'medium',  name: 'Medium',  vh: 6, maxLines: 4, desc: 'Balanced (default)' },
    { id: 'large',   name: 'Large',   vh: 7.5, maxLines: 3, desc: 'Back rows friendly' },
    { id: 'xlarge',  name: 'X-Large', vh: 9, maxLines: 2, desc: 'Maximum impact' },
];

// Current settings state
const settings = {
    themeId:      'ivory-onyx',
    titleFontId:  'tangerine',
    lyricsFontId: 'cormorant',
    sizeId:       'medium',
};

function applySettings() {
    const theme  = THEMES.find(t => t.id === settings.themeId)       || THEMES[0];
    const tFont  = TITLE_FONTS.find(f => f.id === settings.titleFontId)  || TITLE_FONTS[0];
    const lFont  = LYRICS_FONTS.find(f => f.id === settings.lyricsFontId) || LYRICS_FONTS[0];
    const size   = SIZES.find(s => s.id === settings.sizeId)          || SIZES[1];

    const root = document.documentElement;
    root.style.setProperty('--present-bg',         theme.bg);
    root.style.setProperty('--present-text',        theme.text);
    root.style.setProperty('--present-title-font',  tFont.family);
    root.style.setProperty('--present-lyrics-font', lFont.family);
    root.style.setProperty('--present-font-size',   size.vh);

    updatePreview(theme, tFont, lFont, size);
    saveSettings();
}

function updatePreview(theme, tFont, lFont, size) {
    const preview = document.getElementById('slidePreview');
    const previewTitle  = document.getElementById('previewTitle');
    const previewLyrics = document.getElementById('previewLyrics');

    preview.style.background = theme.bg;
    preview.style.color      = theme.text;

    previewTitle.style.fontFamily  = tFont.family;
    previewLyrics.style.fontFamily = lFont.family;

    // Scale font sizes proportionally for the small preview box
    // preview box is ~260px wide; real slide is 100vw — ratio ~0.25
    const previewTitleSize  = Math.max(10, size.vh * 0.18) + 'px';
    const previewLyricsSize = Math.max(8,  size.vh * 0.13) + 'px';
    previewTitle.style.fontSize  = previewTitleSize;
    previewLyrics.style.fontSize = previewLyricsSize;
}

function toggleSettings() {
    const panel   = document.getElementById('settingsPanel');
    const overlay = document.getElementById('settingsOverlay');
    const isOpen  = panel.classList.contains('open');
    panel.classList.toggle('open', !isOpen);
    overlay.classList.toggle('visible', !isOpen);
}

function closeSettingsOutside(e) {
    if (e.target === document.getElementById('settingsOverlay')) {
        toggleSettings();
    }
}

// Build theme grid
function buildThemeGrid() {
    const grid = document.getElementById('themeGrid');
    grid.innerHTML = THEMES.map(t => `
        <div class="theme-swatch ${t.id === settings.themeId ? 'active' : ''}"
             id="swatch-${t.id}"
             onclick="selectTheme('${t.id}')"
             title="${t.desc}"
             style="background:${t.bg}; color:${t.text}; border-color:${t.text}30">
            <span class="swatch-name" style="color:${t.text}">${t.name}</span>
            <span class="swatch-desc" style="color:${t.text}99">${t.desc}</span>
        </div>
    `).join('');
}

function selectTheme(id) {
    settings.themeId = id;
    document.querySelectorAll('.theme-swatch').forEach(el => el.classList.remove('active'));
    document.getElementById('swatch-' + id)?.classList.add('active');
    applySettings();
}

// Build font lists
function buildFontList(containerId, fonts, currentId, onSelect) {
    const container = document.getElementById(containerId);
    container.innerHTML = fonts.map(f => `
        <div class="font-option ${f.id === currentId ? 'active' : ''}"
             id="${containerId}-${f.id}"
             onclick="${onSelect}('${f.id}')">
            <span class="font-name" style="font-family:${f.family}">${f.name}</span>
            <span class="font-sample" style="font-family:${f.family}">${f.sample}</span>
        </div>
    `).join('');
}

function selectTitleFont(id) {
    settings.titleFontId = id;
    document.querySelectorAll('#titleFontList .font-option').forEach(el => el.classList.remove('active'));
    document.getElementById('titleFontList-' + id)?.classList.add('active');
    applySettings();
}

function selectLyricsFont(id) {
    settings.lyricsFontId = id;
    document.querySelectorAll('#lyricsFontList .font-option').forEach(el => el.classList.remove('active'));
    document.getElementById('lyricsFontList-' + id)?.classList.add('active');
    applySettings();
}

// Build size options
function buildSizeOptions() {
    const container = document.getElementById('sizeOptions');
    container.innerHTML = SIZES.map(s => `
        <div class="size-option ${s.id === settings.sizeId ? 'active' : ''}"
             id="size-${s.id}"
             onclick="selectSize('${s.id}')">
            <span class="size-name">${s.name}</span>
            <span class="size-desc">${s.desc}</span>
        </div>
    `).join('');
}

function selectSize(id) {
    settings.sizeId = id;
    document.querySelectorAll('.size-option').forEach(el => el.classList.remove('active'));
    document.getElementById('size-' + id)?.classList.add('active');
    applySettings();
}

// Persist settings in localStorage
function saveSettings() {
    try { localStorage.setItem('hymnalSettings', JSON.stringify(settings)); } catch(e) {}
}

function loadSettings() {
    try {
        const saved = JSON.parse(localStorage.getItem('hymnalSettings'));
        if (saved) Object.assign(settings, saved);
    } catch(e) {}
}

// Init
function initSettings() {
    loadSettings();
    buildThemeGrid();
    buildFontList('titleFontList',  TITLE_FONTS,  settings.titleFontId,  'selectTitleFont');
    buildFontList('lyricsFontList', LYRICS_FONTS, settings.lyricsFontId, 'selectLyricsFont');
    buildSizeOptions();
    applySettings();
}

document.addEventListener('DOMContentLoaded', initSettings);


// ============================================================
// 7. MIDI PLAYER (MIDIjs)
// ============================================================

let currentMidiUrl = '';
let isPlaying = false;

function midiLoad(url) {
    currentMidiUrl = url;
    isPlaying = false;
    updateMidiButtons();
    
    if (currentHymn) {
        document.getElementById('midiStatus').textContent = `${currentHymn.number}. ${currentHymn.title}`;
    }
}

function playMIDI() {
    if (!currentMidiUrl) return;
    MIDIjs.play(currentMidiUrl);
    isPlaying = true;
    updateMidiButtons();
}

function pauseMIDI() {
    MIDIjs.stop();
    isPlaying = false;
    updateMidiButtons();
}

function stopMIDI() {
    MIDIjs.stop();
    isPlaying = false;
    updateMidiButtons();
}

function midiStop() {
    stopMIDI();
}

function updateMidiButtons() {
    const playBtn = document.getElementById('playBtn');
    const pauseBtn = document.getElementById('pauseBtn');
    
    if (isPlaying) {
        playBtn.style.display = 'none';
        pauseBtn.style.display = 'inline-flex';
    } else {
        playBtn.style.display = 'inline-flex';
        pauseBtn.style.display = 'none';
    }
    
    playBtn.disabled = !currentMidiUrl;
    pauseBtn.disabled = !currentMidiUrl;
    document.getElementById('stopBtn').disabled = !currentMidiUrl;
}

// ============================================================
// 8. HYMN NAVIGATION (Prev/Next + Swipe)
// ============================================================

function navigateHymn(direction) {
    if (!currentHymn) return;
    
    const currentIndex = hymns.findIndex(h => h.number === currentHymn.number);
    const nextIndex = currentIndex + direction;
    
    if (nextIndex >= 0 && nextIndex < hymns.length) {
        viewHymn(hymns[nextIndex].number);
    }
}

function updateNavButtons() {
    const prevBtn = document.querySelector('.nav-prev');
    const nextBtn = document.querySelector('.nav-next');
    
    if (!currentHymn) {
        prevBtn.style.display = 'none';
        nextBtn.style.display = 'none';
        return;
    }
    
    const currentIndex = hymns.findIndex(h => h.number === currentHymn.number);
    
    // Show/hide based on position
    prevBtn.style.display = currentIndex > 0 ? 'flex' : 'none';
    nextBtn.style.display = currentIndex < hymns.length - 1 ? 'flex' : 'none';
}

// Touch/Swipe Support for Mobile
let touchStartX = 0;
let touchEndX = 0;

function handleSwipe() {
    const swipeThreshold = 100; // Minimum distance for swipe
    const diff = touchEndX - touchStartX;
    
    if (Math.abs(diff) > swipeThreshold) {
        if (diff > 0) {
            // Swipe right = previous
            navigateHymn(-1);
        } else {
            // Swipe left = next
            navigateHymn(1);
        }
    }
}

document.getElementById('content').addEventListener('touchstart', (e) => {
    touchStartX = e.changedTouches[0].screenX;
});

document.getElementById('content').addEventListener('touchend', (e) => {
    touchEndX = e.changedTouches[0].screenX;
    handleSwipe();
});

// Keyboard navigation (arrow keys)
document.addEventListener('keydown', (e) => {
    // Only if not in presentation mode
    if (document.getElementById('presenter').style.display !== 'flex') {
        if (e.key === 'ArrowLeft') navigateHymn(-1);
        if (e.key === 'ArrowRight') navigateHymn(1);
    }
});

// ============================================================
// 9. CHROMECAST / SCREEN CASTING
// ============================================================

function openCastMenu() {
    // First, enter fullscreen presentation mode
    startPresent(false);
    
    // Then show instructions to user
    setTimeout(() => {
        alert('To cast to your TV:\n\n1. Click the three dots (⋮) in Chrome\n2. Select "Cast..."\n3. Choose your Chromecast/TV\n4. Click "Cast tab"\n\nThe presentation will appear on your TV!');
    }, 500);
}