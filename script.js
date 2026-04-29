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
                <button class="btn-auto" onclick="startPresent(true)">Auto Presentation</button>
            </div>
            <h1>${currentHymn.number}. ${currentHymn.title}</h1>
    `;

    const MAX_LINES_PER_SLIDE = 3;

    currentHymn.verses.forEach((v) => {
        htmlContent += `
            <div class="verse ${v.type === 'refrain' ? 'refrain' : ''}">
                ${v.number ? `<strong>${v.number}.</strong> ` : ''}${v.lines.join('<br>')}
            </div>`;
        
        let tempLines = [...v.lines];
        let partNum = 1;
        
        if (tempLines.length > MAX_LINES_PER_SLIDE) {
            while (tempLines.length > 0) {
                const chunk = tempLines.splice(0, MAX_LINES_PER_SLIDE);
                presentationSequence.push({ 
                    ...v, 
                    lines: chunk, 
                    partLabel: v.lines.length > MAX_LINES_PER_SLIDE ? ` (Part ${partNum})` : "" 
                });
                partNum++;
            }
        } else {
            presentationSequence.push(v);
        }

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
}

// 4. PRESENTATION LOGIC
function startPresent(auto) {
    if (!currentHymn) return;
    isAuto = auto;
    slideIdx = 0;
    const presenter = document.getElementById('presenter');
    
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
                // Regular verse/refrain slide
                if (slide.type === 'refrain') label = "<small>[Refrain]</small><br>";
                else if (slide.number) label = `<small>Verse ${slide.number}${slide.partLabel || ""}</small><br>`;
                
                el.innerHTML = `${label}${slide.lines.join('<br>')}`;
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
    
    // Use the user's chosen base size as starting point
    const baseSizeVh = parseFloat(getComputedStyle(document.documentElement)
        .getPropertyValue('--present-font-size')) || 60;
    
    let fontSize = baseSizeVh;
    textEl.style.fontSize = fontSize + "vh";

    // Auto-shrink if text overflows (for both title and lyrics)
    while (
        (textEl.scrollHeight > container.clientHeight * 0.80 || 
         textEl.scrollWidth > container.clientWidth * 0.90) && 
        fontSize > 8
    ) {
        fontSize -= 0.5;
        textEl.style.fontSize = fontSize + "vh";
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
    { id: 'cinzel',           name: 'Cinzel',             family: "'Cinzel', serif",               sample: 'Amazing Grace' },
    { id: 'unifraktur',       name: 'UnifrakturMaguntia', family: "'UnifrakturMaguntia', cursive",  sample: 'Amazing Grace' },
    { id: 'almendra',         name: 'Almendra',           family: "'Almendra', serif",              sample: 'Amazing Grace' },
    { id: 'gfs-didot',        name: 'GFS Didot',          family: "'GFS Didot', serif",             sample: 'Amazing Grace' },
    { id: 'playfair-display', name: 'Playfair Display',   family: "'Playfair Display', serif",      sample: 'Amazing Grace' },
];

const LYRICS_FONTS = [
    { id: 'cormorant',   name: 'Cormorant Garamond', family: "'Cormorant Garamond', serif",  sample: 'How sweet the sound' },
    { id: 'eb-garamond', name: 'EB Garamond',        family: "'EB Garamond', serif",          sample: 'How sweet the sound' },
    { id: 'lora',        name: 'Lora',               family: "'Lora', serif",                 sample: 'How sweet the sound' },
    { id: 'crimson-pro', name: 'Crimson Pro',        family: "'Crimson Pro', serif",          sample: 'How sweet the sound' },
    { id: 'libre-bask',  name: 'Libre Baskerville',  family: "'Libre Baskerville', serif",    sample: 'How sweet the sound' },
];

const SIZES = [
    { id: 'small',   name: 'Small',   vh: 44, desc: 'More lines visible' },
    { id: 'medium',  name: 'Medium',  vh: 60, desc: 'Balanced (default)' },
    { id: 'large',   name: 'Large',   vh: 74, desc: 'Back rows friendly' },
    { id: 'xlarge',  name: 'X-Large', vh: 88, desc: 'Maximum impact' },
];

// Current settings state
const settings = {
    themeId:      'ivory-onyx',
    titleFontId:  'cinzel',
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
// 7. MIDI PLAYER (html-midi-player)
// ============================================================

function midiLoad(url) {
    const player = document.getElementById('player');
    player.src = url;
    player.stop();
}

function midiStop() {
    const player = document.getElementById('player');
    if (player) player.stop();
}