# 🎵 Digital Hymnal Online

A lightweight, elegant web-based hymnal designed for modern worship services. This application allows users to search for hymns by number or title, view lyrics with beautiful typography, and play MIDI accompaniments directly in the browser[cite: 4, 5].

---

## ✨ Key Features

*   **Smart Search:** Find hymns instantly by number, title, or specific lyrics[cite: 5].
*   **Presentation Mode:** Includes a dedicated "Slide Settings" panel to customize themes, fonts, and text sizes for live projection[cite: 4, 6].
*   **Adaptive Typography:** Automatically adjusts font sizes to ensure lyrics fit the screen perfectly based on the character count[cite: 5].
*   **MIDI Integration:** Built-in audio player using the Magenta.js and `html-midi-player` libraries for high-quality accompaniment[cite: 4, 5].
*   **Customizable Themes:** Choose between several professionally designed themes like "Midnight & Gold" or "Ivory & Onyx"[cite: 6].

---

## 🛠️ File Structure

*   **`index_5.html`**: The main entry point and UI structure[cite: 4].
*   **`script_5.js`**: Handles search logic, slide navigation, and presentation settings[cite: 5].
*   **`style_5.css`**: Contains the responsive design and presentation theme variables[cite: 6].
*   **`logo_2.jpg`**: The official branding used in the header[cite: 4].
*   **`hymns.json`**: The database containing all hymn numbers, titles, and lyrics[cite: 5].
*   **`midi/`**: A directory containing MIDI files named by their hymn number (e.g., `001.mid`)[cite: 5].

---

## 🚀 How to Use

### 1. Searching for a Hymn
*   Start typing in the search bar at the top of the screen[cite: 4].
*   You can enter a **Hymn Number** (e.g., "43") or **Keywords** (e.g., "Grace")[cite: 5].
*   Select the desired hymn from the dropdown list to load its lyrics and MIDI[cite: 5].

### 2. Launching the Presentation
*   Click **"Manual Presentation"** to control slides using your keyboard (Arrow Keys or Spacebar)[cite: 5].
*   Click **"Auto Presentation"** to sync transitions with the MIDI playback[cite: 5].
*   Use the **Escape** key to exit presentation mode at any time[cite: 5].

### 3. Customizing the Look
*   Open the **"Slide Settings"** panel from the header[cite: 4].
*   Use the **Live Preview** to see how your changes look in real-time[cite: 6].
*   Adjust the **Theme**, **Title Font**, **Lyrics Font**, and **Text Size** to fit your auditorium's needs[cite: 6].

---

## 💻 Local Setup

1.  Clone this repository to your local machine.
2.  Ensure you have a local web server running (required for fetching `hymns.json`). 
    *   *Tip:* If you have Python installed, run `python -m http.server 8000` in the project folder.
3.  Open `index_5.html` in your browser[cite: 4].

---

## 📝 Project Note
The typography is powered by a curated selection of Google Fonts—including **Cinzel**, **Cormorant Garamond**, and **UnifrakturMaguntia**—to provide a classic, reverent aesthetic for the sanctuary[cite: 4, 6].