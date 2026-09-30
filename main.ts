/**
 * Obsidian Sanzo Wada Color Combinations Plugin
 * 
 * Provides:
 * 1. Fenced code block processor: ```sanzo <id>```
 * 2. Searchable palette strip modal to browse and insert 348 historic Sanzo Wada combinations
 * 3. Dedicated Sidebar Panel (ItemView) with dual-mode search, live strip previews, favorites, and insert-at-cursor
 * 4. Ribbon icon and Command Palette actions
 * 5. Settings tab for display toggles and default insertion formats
 * 
 * Based on Sanzo Wada's "A Dictionary of Color Combinations" (1930s).
 */

import {
  App,
  Editor,
  ItemView,
  MarkdownPostProcessorContext,
  MarkdownView,
  Modal,
  Notice,
  Plugin,
  PluginSettingTab,
  Setting,
  WorkspaceLeaf,
} from "obsidian";

import rawColors from "./colors.json";
import { SanzoColor } from "./colors";

/**
 * View type identifier for the Sanzo Wada sidebar panel
 */
export const VIEW_TYPE_SANZO_SIDEBAR = "sanzo-sidebar";

/**
 * Combination palette holding an ID and its associated Sanzo colors
 */
export interface SanzoCombination {
  id: number;
  colors: SanzoColor[];
}

/**
 * Plugin configuration settings
 */
export interface SanzoPluginSettings {
  showColorNames: boolean;
  showHexCodes: boolean;
  defaultOutputFormat: "codeblock" | "markdown-swatches" | "hex-list";
  favorites: number[];
}

export const DEFAULT_SETTINGS: SanzoPluginSettings = {
  showColorNames: true,
  showHexCodes: true,
  defaultOutputFormat: "codeblock",
  favorites: [],
};

export default class SanzoWadaPlugin extends Plugin {
  settings: SanzoPluginSettings = DEFAULT_SETTINGS;

  /**
   * Cached list of 159 original colors
   */
  colors: SanzoColor[] = [];

  /**
   * Cached mapping of 348 combinations (IDs 1 through 348)
   */
  combinationsMap: Map<number, SanzoColor[]> = new Map();

  /**
   * Cached sorted list of all combinations for fast modal and sidebar rendering
   */
  allCombinations: SanzoCombination[] = [];

  async onload(): Promise<void> {
    // 1. Load user settings
    await this.loadSettings();

    // 2. Cache raw colors and invert combinations once on load
    this.initColorData();

    // 3. Register the custom sidebar ItemView
    this.registerView(
      VIEW_TYPE_SANZO_SIDEBAR,
      (leaf: WorkspaceLeaf) => new SanzoSidebarView(leaf, this)
    );

    // 4. Register the `sanzo` fenced code block processor
    this.registerMarkdownCodeBlockProcessor(
      "sanzo",
      (source: string, el: HTMLElement, _ctx: MarkdownPostProcessorContext) => {
        this.renderSanzoCodeBlock(source, el);
      }
    );

    // 5. Ribbon icon: Opens the sidebar in the right leaf
    this.addRibbonIcon("palette", "Sanzo Wada Palettes", () => {
      void this.activateView();
    });

    // 6. Command: Open Sanzo Wada sidebar
    this.addCommand({
      id: "open-sanzo-sidebar",
      name: "Open Sanzo Wada sidebar",
      callback: () => {
        void this.activateView();
      },
    });

    // 7. Command: Insert Sanzo Wada palette via modal
    this.addCommand({
      id: "insert-sanzo-palette",
      name: "Insert Sanzo Wada palette",
      editorCallback: (editor: Editor) => {
        this.openPaletteModal(editor);
      },
    });

    // 8. Register settings tab
    this.addSettingTab(new SanzoSettingTab(this.app, this));
  }

  onunload(): void {
    // Intentionally empty.
    // Obsidian manages leaf cleanup automatically; calling detachLeavesOfType here
    // would reset the user's custom placement of the sidebar on plugin reload.
  }

  async loadSettings(): Promise<void> {
    const loadedData = (await this.loadData()) as Partial<SanzoPluginSettings> | null;
    this.settings = Object.assign({}, DEFAULT_SETTINGS, loadedData);
    if (!Array.isArray(this.settings.favorites)) {
      this.settings.favorites = [];
    }
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  /**
   * Toggles a combination ID in the user's favorites array and persists settings.
   */
  async toggleFavorite(comboId: number): Promise<boolean> {
    const index = this.settings.favorites.indexOf(comboId);
    let isFav = false;
    if (index >= 0) {
      this.settings.favorites.splice(index, 1);
      isFav = false;
    } else {
      this.settings.favorites.push(comboId);
      isFav = true;
    }
    await this.saveSettings();
    return isFav;
  }

  /**
   * Checks if a combination ID is currently starred as favorite.
   */
  isFavorite(comboId: number): boolean {
    return this.settings.favorites.includes(comboId);
  }

  /**
   * Activates or reveals the Sanzo Wada sidebar in the right dock leaf.
   */
  async activateView(): Promise<void> {
    const { workspace } = this.app;
    let leaf: WorkspaceLeaf | null = null;
    const leaves = workspace.getLeavesOfType(VIEW_TYPE_SANZO_SIDEBAR);

    if (leaves.length > 0) {
      leaf = leaves[0];
    } else {
      leaf = workspace.getRightLeaf(false) ?? workspace.getLeaf(true);
      if (leaf) {
        await leaf.setViewState({ type: VIEW_TYPE_SANZO_SIDEBAR, active: true });
      }
    }

    if (leaf) {
      await workspace.revealLeaf(leaf);
    }
  }

  /**
   * Inserts the formatted combination into the currently active Markdown editor at the cursor.
   * If no active Markdown editor is found, falls back to the first open Markdown view,
   * or copies the formatted text to the clipboard and shows a Notice.
   */
  insertOrCopyCombination(combo: SanzoCombination): void {
    const outputText = this.formatCombination(combo);
    const workspace = this.app.workspace;

    const activeEditor =
      workspace.getActiveViewOfType(MarkdownView)?.editor ??
      (workspace.getLeavesOfType("markdown")
        .map((leaf) => leaf.view)
        .find((view): view is MarkdownView => view instanceof MarkdownView)
        ?.editor);

    if (activeEditor) {
      activeEditor.replaceSelection(outputText);
      new Notice(`Inserted Sanzo Wada palette #${combo.id}`);
    } else {
      void navigator.clipboard.writeText(outputText);
      new Notice(`Copied Sanzo Wada palette #${combo.id} to clipboard!`);
    }
  }

  /**
   * Inverts the color.combinations field from colors.json.
   * Each color contains an array of combination IDs it belongs to.
   * This builds a complete Map of ID -> SanzoColor[] (348 total combinations).
   */
  private initColorData(): void {
    this.colors = rawColors as SanzoColor[];
    const map = new Map<number, SanzoColor[]>();

    for (const color of this.colors) {
      if (!color.combinations || !Array.isArray(color.combinations)) continue;
      for (const comboId of color.combinations) {
        if (!map.has(comboId)) {
          map.set(comboId, []);
        }
        map.get(comboId)!.push(color);
      }
    }

    this.combinationsMap = map;

    // Build sorted array 1..348
    this.allCombinations = Array.from(map.entries())
      .map(([id, colors]) => ({ id, colors }))
      .sort((a, b) => a.id - b.id);
  }

  /**
   * Opens the palette selection modal.
   * If an active editor is passed or found, inserts the chosen palette at the cursor.
   */
  openPaletteModal(editor?: Editor): void {
    const targetEditor =
      editor ||
      this.app.workspace.getActiveViewOfType(MarkdownView)?.editor;

    new SanzoPaletteModal(this.app, this, (combination: SanzoCombination) => {
      const outputText = this.formatCombination(combination);

      if (targetEditor) {
        targetEditor.replaceSelection(outputText);
        new Notice(`Inserted Sanzo Wada palette #${combination.id}`);
      } else {
        void navigator.clipboard.writeText(outputText);
        new Notice(
          `Copied Sanzo Wada palette #${combination.id} to clipboard!`
        );
      }
    }).open();
  }

  /**
   * Formats the combination into the user's preferred insertion format
   */
  formatCombination(combo: SanzoCombination): string {
    const format = this.settings.defaultOutputFormat;
    switch (format) {
      case "codeblock":
        return `\`\`\`sanzo\n${combo.id}\n\`\`\`\n`;
      case "markdown-swatches": {
        const hexList = combo.colors.map((c) => `\`${c.hex}\` (${c.name})`).join(", ");
        return `> **Sanzo Wada Combination #${combo.id}** (${combo.colors.length} Colors)\n> ${hexList}\n\n`;
      }
      case "hex-list":
        return combo.colors.map((c) => c.hex).join(", ") + "\n";
      default:
        return `\`\`\`sanzo\n${combo.id}\n\`\`\`\n`;
    }
  }

  /**
   * Fenced Code Block Processor for ```sanzo
   * Usage:
   * ```sanzo
   * 12
   * ```
   * If empty or invalid, renders a random palette.
   */
  private renderSanzoCodeBlock(source: string, el: HTMLElement): void {
    const cleanSource = source.trim();
    let comboId: number;

    if (!cleanSource) {
      // No ID specified: pick a random combination from 1 to 348
      const randomIdx = Math.floor(Math.random() * this.allCombinations.length);
      comboId = this.allCombinations[randomIdx]?.id ?? 1;
    } else {
      // Parse ID from source, tolerating "#12", "id: 12", etc.
      const parsed = parseInt(cleanSource.replace(/[^\d]/g, ""), 10);
      comboId = isNaN(parsed) ? 1 : parsed;
    }

    const colors = this.combinationsMap.get(comboId);

    if (!colors || colors.length === 0) {
      const errBox = el.createDiv({ cls: "sanzo-error-card" });
      errBox.setText(
        `Sanzo Wada palette #${comboId} not found. Valid IDs range from 1 to 348.`
      );
      return;
    }

    // Outer card container
    const container = el.createDiv({ cls: "sanzo-palette-container" });

    // Palette Header
    const header = container.createDiv({ cls: "sanzo-palette-header" });

    const titleGroup = header.createDiv({ cls: "sanzo-palette-title-group" });
    titleGroup.createSpan({
      cls: "sanzo-palette-title",
      text: `Sanzo Wada #${comboId}`,
    });
    titleGroup.createSpan({
      cls: "sanzo-palette-badge",
      text: `${colors.length} Colors`,
    });

    // Action buttons in header
    const actions = header.createDiv({ cls: "sanzo-header-actions" });

    const copyAllBtn = actions.createEl("button", {
      cls: "sanzo-icon-btn",
      text: "Copy All HEX",
      attr: { type: "button", title: "Copy all hex codes in palette" },
    });

    copyAllBtn.addEventListener("click", (e: MouseEvent) => {
      e.stopPropagation();
      const allHex = colors.map((c) => c.hex).join(", ");
      void navigator.clipboard.writeText(allHex);
      new Notice(`Copied palette #${comboId} (${allHex}) to clipboard!`);
    });

    // Swatches Grid
    const swatchesGrid = container.createDiv({ cls: "sanzo-swatches-grid" });

    for (const color of colors) {
      const item = swatchesGrid.createDiv({ cls: "sanzo-swatch-item" });
      item.setAttribute("title", `Click to copy ${color.name} (${color.hex})`);

      // Color swatch box
      const box = item.createDiv({ cls: "sanzo-swatch-box" });
      box.style.backgroundColor = color.hex;

      // Overlay hex tag on hover
      const overlay = box.createDiv({ cls: "sanzo-swatch-overlay" });
      overlay.setText(color.hex.toUpperCase());

      // Optional text information under swatch
      if (this.settings.showColorNames || this.settings.showHexCodes) {
        const info = item.createDiv({ cls: "sanzo-swatch-info" });

        if (this.settings.showColorNames) {
          info.createSpan({
            cls: "sanzo-color-name",
            text: color.name,
          });
        }

        if (this.settings.showHexCodes) {
          info.createSpan({
            cls: "sanzo-color-hex",
            text: color.hex.toUpperCase(),
          });
        }
      }

      // Click to copy color hex
      item.addEventListener("click", () => {
        void navigator.clipboard.writeText(color.hex);
        new Notice(`Copied ${color.name} (${color.hex}) to clipboard!`);
      });
    }
  }
}

/**
 * Sidebar Panel (ItemView) for browsing, searching, favoriting, and inserting palettes
 */
export class SanzoSidebarView extends ItemView {
  plugin: SanzoWadaPlugin;
  searchQuery: string = "";
  searchMode: "name" | "id" = "name";
  favoritesCollapsed: boolean = false;

  private favoritesSectionTitleEl!: HTMLElement;
  private favoritesListEl!: HTMLElement;
  private resultsSectionTitleEl!: HTMLElement;
  private resultsListEl!: HTMLElement;

  constructor(leaf: WorkspaceLeaf, plugin: SanzoWadaPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string {
    return VIEW_TYPE_SANZO_SIDEBAR;
  }

  getDisplayText(): string {
    return "Sanzo Wada Palettes";
  }

  getIcon(): string {
    return "palette";
  }

  async onOpen(): Promise<void> {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("sanzo-sidebar-container");

    // Search bar area
    const searchSection = contentEl.createDiv({ cls: "sanzo-sidebar-search" });

    const controlsRow = searchSection.createDiv({ cls: "sanzo-sidebar-search-controls" });

    const searchInput = controlsRow.createEl("input", {
      cls: "sanzo-sidebar-search-input",
      type: "text",
      placeholder: "Search color name (e.g. coral, pink)...",
    });

    const modeSelect = controlsRow.createEl("select", {
      cls: "sanzo-sidebar-search-select",
      attr: { "aria-label": "Search mode" },
    });

    modeSelect.createEl("option", { text: "By Color", value: "name" });
    modeSelect.createEl("option", { text: "By ID #", value: "id" });

    // Favorites section
    const favSection = contentEl.createDiv({ cls: "sanzo-sidebar-section" });
    this.favoritesSectionTitleEl = favSection.createDiv({
      cls: "sanzo-sidebar-section-title",
    });

    this.favoritesSectionTitleEl.addEventListener("click", () => {
      this.favoritesCollapsed = !this.favoritesCollapsed;
      this.renderFavorites();
    });

    this.favoritesListEl = favSection.createDiv();

    // Results section
    const resultsSection = contentEl.createDiv({ cls: "sanzo-sidebar-section" });
    this.resultsSectionTitleEl = resultsSection.createDiv({
      cls: "sanzo-sidebar-section-title",
    });
    this.resultsListEl = resultsSection.createDiv();

    // Listeners for search
    searchInput.addEventListener("input", () => {
      this.searchQuery = searchInput.value;
      this.renderResults();
    });

    modeSelect.addEventListener("change", () => {
      this.searchMode = modeSelect.value as "name" | "id";
      searchInput.placeholder =
        this.searchMode === "name"
          ? "Search color name (e.g. coral, pink)..."
          : "Enter combination ID (1–348)...";
      this.renderResults();
    });

    // Initial renders
    this.renderFavorites();
    this.renderResults();
  }

  async onClose(): Promise<void> {
    // No cleanup needed - Obsidian manages the DOM lifecycle
  }

  /**
   * Renders the collapsible favorites section
   */
  renderFavorites(): void {
    const favIds = this.plugin.settings.favorites;
    const count = favIds.length;
    const arrow = this.favoritesCollapsed ? "▶" : "▼";

    this.favoritesSectionTitleEl.setText(`★ Favorites (${count}) ${arrow}`);
    this.favoritesListEl.empty();

    if (this.favoritesCollapsed) {
      return;
    }

    if (count === 0) {
      const emptyEl = this.favoritesListEl.createDiv({ cls: "sanzo-sidebar-empty" });
      emptyEl.setText("No favorite palettes yet. Click the star on any combination to save it here.");
      return;
    }

    for (const id of favIds) {
      const colors = this.plugin.combinationsMap.get(id);
      if (colors && colors.length > 0) {
        this.renderCombinationRow(this.favoritesListEl, { id, colors }, "");
      }
    }
  }

  /**
   * Renders the search results or full palette list
   */
  renderResults(): void {
    this.resultsListEl.empty();
    const q = this.searchQuery.trim().toLowerCase();

    let displayList: SanzoCombination[] = [];

    if (this.searchMode === "name") {
      if (!q) {
        displayList = this.plugin.allCombinations;
        this.resultsSectionTitleEl.setText(`All Palettes (${displayList.length})`);
      } else {
        const scored: { combo: SanzoCombination; matchCount: number }[] = [];

        for (const combo of this.plugin.allCombinations) {
          let matches = 0;
          for (const color of combo.colors) {
            if (color.name.toLowerCase().includes(q)) {
              matches++;
            }
          }
          if (matches > 0) {
            scored.push({ combo, matchCount: matches });
          }
        }

        // Sort so combinations containing more matches come first, then by ID
        scored.sort((a, b) => {
          if (b.matchCount !== a.matchCount) {
            return b.matchCount - a.matchCount;
          }
          return a.combo.id - b.combo.id;
        });

        displayList = scored.map((item) => item.combo);
        this.resultsSectionTitleEl.setText(`Results (${displayList.length})`);
      }
    } else {
      // Search by combination ID
      if (!q) {
        displayList = this.plugin.allCombinations;
        this.resultsSectionTitleEl.setText(`All Palettes (${displayList.length})`);
      } else {
        const parsedId = parseInt(q.replace(/[^\d]/g, ""), 10);
        if (!isNaN(parsedId)) {
          const colors = this.plugin.combinationsMap.get(parsedId);
          if (colors && colors.length > 0) {
            displayList = [{ id: parsedId, colors }];
          } else {
            displayList = [];
          }
        } else {
          displayList = [];
        }
        this.resultsSectionTitleEl.setText(`Palette #${q} (${displayList.length})`);
      }
    }

    if (displayList.length === 0) {
      const emptyEl = this.resultsListEl.createDiv({ cls: "sanzo-sidebar-empty" });
      emptyEl.setText(
        this.searchMode === "name"
          ? `No color combinations found matching "${this.searchQuery}".`
          : `No combination found with ID #${this.searchQuery}. Valid IDs are 1–348.`
      );
      return;
    }

    for (const combo of displayList) {
      this.renderCombinationRow(this.resultsListEl, combo, q);
    }
  }

  /**
   * Helper that renders a combination row with title, color names, strip, and star button
   */
  private renderCombinationRow(
    containerEl: HTMLElement,
    combo: SanzoCombination,
    highlightQuery: string
  ): HTMLElement {
    const isFav = this.plugin.isFavorite(combo.id);

    const row = containerEl.createDiv({ cls: "sanzo-sidebar-row" });

    const rowHeader = row.createDiv({ cls: "sanzo-sidebar-row-header" });

    const meta = rowHeader.createDiv({ cls: "sanzo-sidebar-row-meta" });
    meta.createSpan({
      cls: "sanzo-sidebar-row-title",
      text: `Combo #${combo.id}`,
    });

    const namesText = combo.colors.map((c) => c.name).join(", ");
    meta.createSpan({
      cls: "sanzo-sidebar-row-names",
      text: namesText,
    });

    const starBtn = rowHeader.createEl("button", {
      cls: `sanzo-sidebar-star ${isFav ? "sanzo-sidebar-star-active" : ""}`,
      text: isFav ? "★" : "☆",
      attr: {
        type: "button",
        title: isFav ? "Remove from favorites" : "Add to favorites",
        "aria-label": isFav ? "Remove from favorites" : "Add to favorites",
      },
    });

    starBtn.addEventListener("click", (e: MouseEvent) => {
      e.stopPropagation();
      void this.handleFavoriteToggle(combo);
    });

    // Horizontal Color Strip
    const strip = row.createDiv({ cls: "sanzo-sidebar-strip" });
    const q = highlightQuery.trim().toLowerCase();

    for (const color of combo.colors) {
      const isMatch =
        this.searchMode === "name" &&
        q.length > 0 &&
        color.name.toLowerCase().includes(q);

      const barCls = `sanzo-strip-color ${isMatch ? "sanzo-strip-color-match" : ""}`;
      const bar = strip.createDiv({ cls: barCls });
      bar.style.backgroundColor = color.hex;
      bar.setAttribute("title", `${color.name} (${color.hex})`);
    }

    // Row click inserts palette into note at cursor or copies
    row.addEventListener("click", () => {
      this.plugin.insertOrCopyCombination(combo);
    });

    return row;
  }

  /**
   * Handles the async favorite-toggle work for a row, called via `void` from the click handler.
   */
  private async handleFavoriteToggle(combo: SanzoCombination): Promise<void> {
    await this.plugin.toggleFavorite(combo.id);
    this.renderFavorites();
    this.renderResults();
  }
}

/**
 * Modal listing all 348 combinations as horizontal preview strips
 */
class SanzoPaletteModal extends Modal {
  plugin: SanzoWadaPlugin;
  onSelect: (combo: SanzoCombination) => void;
  filteredList: SanzoCombination[] = [];

  constructor(
    app: App,
    plugin: SanzoWadaPlugin,
    onSelect: (combo: SanzoCombination) => void
  ) {
    super(app);
    this.plugin = plugin;
    this.onSelect = onSelect;
    this.filteredList = this.plugin.allCombinations;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("sanzo-modal-container");

    // Modal Header
    const header = contentEl.createDiv({ cls: "sanzo-modal-header" });
    header.createEl("h3", { text: "Sanzo Wada Color Combinations (1–348)" });
    header.createEl("p", {
      cls: "setting-item-description",
      text: "Select a combination strip to insert into your note, or search by ID and color names.",
    });

    // Search bar
    const searchWrapper = contentEl.createDiv({
      cls: "sanzo-modal-search-wrapper",
    });

    const searchInput = searchWrapper.createEl("input", {
      cls: "sanzo-modal-search-input",
      type: "text",
      placeholder: "Search by combination # (e.g. 12) or color name (e.g. Coral, Pink, Blue)...",
    });

    const resultsList = contentEl.createDiv({
      cls: "sanzo-modal-results-scroll",
    });

    const renderResults = () => {
      resultsList.empty();

      if (this.filteredList.length === 0) {
        resultsList.createEl("div", {
          cls: "setting-item-description",
          text: "No color combinations found matching your query.",
        });
        return;
      }

      for (const combo of this.filteredList) {
        const row = resultsList.createDiv({ cls: "sanzo-modal-row" });

        // Meta info (ID + colors summary)
        const meta = row.createDiv({ cls: "sanzo-modal-row-meta" });
        meta.createSpan({
          cls: "sanzo-modal-row-title",
          text: `Combo #${combo.id}`,
        });
        meta.createSpan({
          cls: "sanzo-modal-row-subtitle",
          text: `${combo.colors.length} colors`,
        });

        // Horizontal Preview Strip
        const strip = row.createDiv({ cls: "sanzo-modal-strip" });
        for (const color of combo.colors) {
          const bar = strip.createDiv({ cls: "sanzo-modal-strip-color" });
          bar.style.backgroundColor = color.hex;
          bar.setAttribute("title", `${color.name} (${color.hex})`);
        }

        // Click row to insert
        row.addEventListener("click", () => {
          this.close();
          this.onSelect(combo);
        });
      }
    };

    // Filter logic
    searchInput.addEventListener("input", () => {
      const q = searchInput.value.trim().toLowerCase();
      if (!q) {
        this.filteredList = this.plugin.allCombinations;
      } else {
        this.filteredList = this.plugin.allCombinations.filter((combo) => {
          if (combo.id.toString() === q || `combo #${combo.id}`.includes(q)) {
            return true;
          }
          return combo.colors.some(
            (c) =>
              c.name.toLowerCase().includes(q) ||
              c.hex.toLowerCase().includes(q)
          );
        });
      }
      renderResults();
    });

    renderResults();
    window.setTimeout(() => searchInput.focus(), 50);
  }

  onClose(): void {
    const { contentEl } = this;
    contentEl.empty();
  }
}

/**
 * Plugin Settings Tab (Declarative API, Obsidian 1.13+)
 */
class SanzoSettingTab extends PluginSettingTab {
  plugin: SanzoWadaPlugin;

  constructor(app: App, plugin: SanzoWadaPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  getSettingDefinitions() {
    return [
      {
        name: "Show color names under swatches",
        desc: "Displays Sanzo Wada's original color names beneath each swatch card.",
        control: {
          type: "toggle" as const,
          key: "showColorNames",
          value: this.plugin.settings.showColorNames,
          onChange: async (value: boolean) => {
            this.plugin.settings.showColorNames = value;
            await this.plugin.saveSettings();
          },
        },
      },
      {
        name: "Show hex codes under swatches",
        desc: "Displays uppercase HEX codes beneath each swatch card.",
        control: {
          type: "toggle" as const,
          key: "showHexCodes",
          value: this.plugin.settings.showHexCodes,
          onChange: async (value: boolean) => {
            this.plugin.settings.showHexCodes = value;
            await this.plugin.saveSettings();
          },
        },
      },
      {
        name: "Default output format",
        desc: "The syntax format inserted when picking a combination from the palette modal or sidebar.",
        control: {
          type: "dropdown" as const,
          key: "defaultOutputFormat",
          value: this.plugin.settings.defaultOutputFormat,
          options: {
            codeblock: "Fenced Codeblock (```sanzo <id>)",
            "markdown-swatches": "Markdown Blockquote & Badges",
            "hex-list": "Comma-separated HEX list",
          },
          onChange: async (value: string) => {
            this.plugin.settings.defaultOutputFormat = value as SanzoPluginSettings["defaultOutputFormat"];
            await this.plugin.saveSettings();
          },
        },
      },
    ];
  }
}