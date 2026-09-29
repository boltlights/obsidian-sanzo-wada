# Sanzo Wada Color Combinations for Obsidian

A beautiful, lightweight Obsidian plugin that brings the timeless palettes of Sanzo Wada's 1930s work *A Dictionary of Color Combinations* (*Haishoku Sōkan*) directly into your vault.

Explore, preview, favorite, and embed all **348 historical color combinations** derived from Wada's **159 original color swatches**.

![Obsidian Sanzo Wada Plugin](https://img.shields.io/badge/Obsidian-Plugin-7c3aed?style=flat&logo=obsidian)
![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)

---

## Features

- 🎨 **Fenced Code Block Processor** (`` ```sanzo ``):
  - Render any palette directly in Reading or Live Preview modes:

    ````markdown
    ```sanzo
    12
    ```
    ````

  - Omit the ID (`` ```sanzo ``) to generate a **random combination** for inspiration!
  - Interactive swatches: hover to see hex codes, click any swatch to copy its HEX value with an Obsidian `Notice`.
  - Includes a "Copy All HEX" button for quick palette exports.

- 🗂️ **Sidebar Panel** (`ItemView`):
  - Open the dedicated **Sanzo Wada Palettes** sidebar leaf via the ribbon icon or command.
  - **Dual-Mode Search**:
    - **By Color Name** (Default): Search terms like `"coral"`, `"pink"`, or `"cobalt"`. Combinations with more matched colors sort to the top, and matched color bars are highlighted with an outline.
    - **By ID #**: Enter any combination ID from `1` to `348` to pull up that exact palette.
  - **Favorites Section**: Star (★ / ☆) your favorite palettes. Starred palettes are saved in plugin data and grouped in a collapsible favorites section at the top of the sidebar.
  - **Insert at Cursor**: Click any row in the sidebar to insert that palette directly into your open note at the cursor. If no markdown note is open, it automatically copies the palette to your clipboard!

- 🔍 **Palette Strip Modal**:
  - Quick popup dialog listing all 348 combinations as horizontal color strips.
  - Trigger via the Command Palette (`Insert Sanzo Wada palette`).

- ⚙️ **Customizable Settings**:
  - Toggle color names under swatches.
  - Toggle hex codes under swatches.
  - Configure default insertion format:
    - **Fenced Code Block** (`` ```sanzo <id> ``)
    - **Markdown Blockquote & Badges**
    - **Comma-separated HEX list**

---

## Usage

### 1. Fenced Code Blocks

Add a code block with the language `sanzo` followed by any palette ID between `1` and `348`:

````markdown
# Design Notes

Here is a 3-color palette for UI headers:

```sanzo
12
```

And a gentle floral combination:

```sanzo
176
```

Or leave it blank for a random palette:

```sanzo
```
````

### 2. Sidebar Panel

1. Click the **Palette** ribbon icon on the left sidebar, or open the Command Palette (`Ctrl/Cmd + P`) and run:
   > `Sanzo Wada: Open Sanzo Wada sidebar`
2. Search by color name (e.g., `lavender`, `green`) or switch to `By ID #`.
3. Click any row to insert it into your active note.
4. Click the star (★) to add it to your pinned **Favorites**.

---

## Installation

### Manual Installation

1. Download the latest release (`main.js`, `manifest.json`, `styles.css`).
2. In your Obsidian vault, navigate to `.obsidian/plugins/`.
3. Create a folder named `obsidian-sanzo-wada` and move the three files into it:

   ```
   <Vault>/.obsidian/plugins/obsidian-sanzo-wada/
   ├── main.js
   ├── manifest.json
   └── styles.css
   ```

4. In Obsidian, go to **Settings → Community plugins** and click **Reload plugins**.
5. Enable **Sanzo Wada Color Combinations**.

---

## Building from Source

```bash
# Clone or create project directory
git clone https://github.com/boltlights/obsidian-sanzo-wada.git
cd obsidian-sanzo-wada

# Install dependencies
npm install

# Build for production
npm run build

# Or run development mode with auto-rebuild
npm run dev
```

---

## Credits & Attribution

This plugin would not be possible without the incredible work of others. The color data used here is from the `dictionary-of-colour-combinations` package.

- **Original Concept**: The color combinations are from the book *"A Dictionary of Colour Combinations"* by Sanzo Wada (1883 – 1967), published by Seigensha Art.
- **Data Compilation**: The data was originally compiled and open-sourced by Dain M. Blodorn Kim ([@dblodorn](https://github.com/dblodorn)) for his interactive web project, [sanzo-wada](https://github.com/dblodorn/sanzo-wada).
- **Data Refinement**: The `dictionary-of-colour-combinations` npm package was created by Matt DesLauriers ([@mattdesl](https://github.com/mattdesl)), who refined the data and improved the CMYK-to-RGB conversion for better print accuracy.

This project is licensed under the MIT License. The original `dictionary-of-colour-combinations` data is also licensed under the MIT License. A copy of the original license is included in this repository (`THIRD_PARTY_LICENSES.md`).