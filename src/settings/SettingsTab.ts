import {
  App,
  PluginSettingTab,
  Setting,
  TextComponent,
  TextAreaComponent,
  DropdownComponent,
  ButtonComponent,
  TFile,
  Notice,
  Modal,
  SuggestModal,
} from "obsidian";
import MemoChron from "../main";
import { CalendarSource } from "./types";

export class SettingsTab extends PluginSettingTab {
  constructor(
    app: App, 
    private plugin: MemoChron
  ) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    this.renderCalendarSection();
    this.renderGeneralSection();
    this.renderNotesSection();
  }

  private renderCalendarSection(): void {
    this.createHeading("Calendar sources", "Add and manage your iCalendar URLs");
    
    new Setting(this.containerEl).addButton((btn) =>
      btn.setButtonText("Add calendar").onClick(() => this.addNewCalendar())
    );

    const calendarContainer = this.containerEl.createEl("div", {
      cls: "memochron-calendar-list",
    });

    this.plugin.settings.calendarUrls.forEach((source, index) => {
      this.renderCalendarSource(calendarContainer, source, index);
    });
  }

  private renderGeneralSection(): void {
    this.renderFirstDayOfWeek();
    this.renderHideCalendar();
    this.renderEnableCalendarColors();
    this.renderRefreshInterval();
  }

  private renderNotesSection(): void {
    new Setting(this.containerEl).setName("Notes").setHeading();
    
    this.renderNoteLocation();
    this.renderFolderPathTemplate();
    this.renderNoteTitleFormat();
    this.renderNoteDateFormat();
    this.renderDefaultFrontmatter();
    this.renderNoteTemplate();
    this.renderDefaultTags();
  }

  private createHeading(name: string, desc: string): void {
    new Setting(this.containerEl)
      .setName(name)
      .setDesc(desc);
  }

  private async addNewCalendar(): Promise<void> {
    const newCalendar: CalendarSource = {
      url: "",
      name: "New calendar",
      enabled: true,
      tags: [],
    };

    // Auto-assign color if colors are enabled
    if (this.plugin.settings.enableCalendarColors) {
      newCalendar.color = this.getNextAvailableColor();
    }

    this.plugin.settings.calendarUrls.push(newCalendar);
    await this.plugin.saveSettings();
    this.display();
  }

  private getNextAvailableColor(): string {
    // Generate a random hue for auto-assignment
    const usedColors = this.plugin.settings.calendarUrls.length;
    const hue = (usedColors * 137.5) % 360; // Golden angle for nice distribution
    return `hsl(${hue}, 70%, 50%)`;
  }

  private renderCalendarSource(
    container: HTMLElement, 
    source: CalendarSource, 
    index: number
  ): void {
    const setting = new Setting(container)
      .addText((text) => this.setupUrlInput(text, source, index))
      .addButton((btn) => this.setupFilePickerButton(btn, index))
      .addText((text) => this.setupNameInput(text, source, index))
      .addText((text) => this.setupTagsInput(text, source, index));
    
    // Add color picker if colors are enabled
    if (this.plugin.settings.enableCalendarColors) {
      setting.addButton((btn) => this.setupColorPicker(btn, source, index));
    }
    
    setting
      .addToggle((toggle) => this.setupEnabledToggle(toggle, source, index))
      .addButton((btn) => this.setupRemoveButton(btn, index));
  }

  private setupUrlInput(
    text: TextComponent, 
    source: CalendarSource, 
    index: number
  ): TextComponent {
    return text
      .setPlaceholder("Calendar URL or file path")
      .setValue(source.url)
      .onChange(async (value) => {
        this.plugin.settings.calendarUrls[index].url = value;
        await this.plugin.saveSettings();
      });
  }

  private setupFilePickerButton(
    btn: ButtonComponent,
    index: number
  ): ButtonComponent {
    return btn
      .setIcon("folder-open")
      .setTooltip("Choose ICS file from vault")
      .onClick(async () => {
        const files = this.app.vault.getFiles().filter(f => f.extension === "ics");
        
        if (files.length === 0) {
          new Notice("No ICS files found in vault");
          return;
        }

        // Create a simple file picker modal
        const modal = new FilePickerModal(this.app, files, async (file) => {
          this.plugin.settings.calendarUrls[index].url = file.path;
          await this.plugin.saveSettings();
          this.display();
        });
        modal.open();
      });
  }

  private setupNameInput(
    text: TextComponent, 
    source: CalendarSource, 
    index: number
  ): TextComponent {
    return text
      .setPlaceholder("Calendar name")
      .setValue(source.name)
      .onChange(async (value) => {
        this.plugin.settings.calendarUrls[index].name = value;
        await this.plugin.saveSettings();
      });
  }

  private setupTagsInput(
    text: TextComponent, 
    source: CalendarSource, 
    index: number
  ): TextComponent {
    return text
      .setPlaceholder("Tags (comma-separated)")
      .setValue(source.tags?.join(", ") || "")
      .onChange(async (value) => {
        this.plugin.settings.calendarUrls[index].tags = this.parseTags(value);
        await this.plugin.saveSettings();
      });
  }

  private setupEnabledToggle(
    toggle: any, 
    source: CalendarSource, 
    index: number
  ): any {
    return toggle.setValue(source.enabled).onChange(async (value: boolean) => {
      this.plugin.settings.calendarUrls[index].enabled = value;
      await this.plugin.saveSettings();
      await this.plugin.refreshCalendarView();
    });
  }

  private setupRemoveButton(btn: any, index: number): any {
    return btn.setButtonText("Remove").onClick(async () => {
      this.plugin.settings.calendarUrls.splice(index, 1);
      await this.plugin.saveSettings();
      await this.plugin.refreshCalendarView();
      this.display();
    });
  }

  private setupColorPicker(
    btn: ButtonComponent,
    source: CalendarSource,
    index: number
  ): ButtonComponent {
    const currentColor = source.color || this.getNextAvailableColor();
    
    return btn
      .setButtonText("Color")
      .setTooltip("Choose calendar color")
      .onClick(() => {
        this.showColorPicker(source, index, btn);
      })
      .then((button) => {
        // Add a visual color indicator
        this.updateColorButton(button.buttonEl, currentColor);
        return button;
      });
  }

  private updateColorButton(buttonEl: HTMLElement, color: string) {
    buttonEl.style.setProperty("--selected-color", color);
    buttonEl.classList.add("memochron-color-button");
  }

  private showColorPicker(source: CalendarSource, index: number, button: ButtonComponent) {
    const currentColor = source.color || this.getNextAvailableColor();
    const modal = new ColorPickerModal(this.app, currentColor, async (selectedColor) => {
      this.plugin.settings.calendarUrls[index].color = selectedColor;
      await this.plugin.saveSettings();
      // Update colors visually without fetching calendar data
      this.plugin.updateCalendarColors();
      this.updateColorButton(button.buttonEl, selectedColor);
    });
    modal.open();
  }

  private renderFirstDayOfWeek(): void {
    const weekdays = [
      { value: "0", label: "Sunday" },
      { value: "1", label: "Monday" },
      { value: "2", label: "Tuesday" },
      { value: "3", label: "Wednesday" },
      { value: "4", label: "Thursday" },
      { value: "5", label: "Friday" },
      { value: "6", label: "Saturday" },
    ];

    new Setting(this.containerEl)
      .setName("First day of the week")
      .setDesc("Choose which day the week starts on")
      .addDropdown((dropdown) => {
        weekdays.forEach(({ value, label }) => {
          dropdown.addOption(value, label);
        });
        
        dropdown
          .setValue(String(this.plugin.settings.firstDayOfWeek))
          .onChange(async (value) => {
            this.plugin.settings.firstDayOfWeek = parseInt(value);
            await this.plugin.saveSettings();
            await this.plugin.refreshCalendarView();
          });
      });
  }

  private renderHideCalendar(): void {
    new Setting(this.containerEl)
      .setName("Hide calendar")
      .setDesc("Show only the agenda view without the month calendar grid")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.hideCalendar)
          .onChange(async (value) => {
            this.plugin.settings.hideCalendar = value;
            await this.plugin.saveSettings();
            await this.plugin.refreshCalendarView();
          })
      );
  }

  private renderEnableCalendarColors(): void {
    new Setting(this.containerEl)
      .setName("Enable calendar colors")
      .setDesc("Show calendars in different colors for easy identification")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.enableCalendarColors)
          .onChange(async (value) => {
            this.plugin.settings.enableCalendarColors = value;
            
            // Auto-assign colors to existing calendars if enabling
            if (value) {
              this.plugin.settings.calendarUrls.forEach((source, index) => {
                if (!source.color) {
                  const hue = (index * 137.5) % 360;
                  source.color = `hsl(${hue}, 70%, 50%)`;
                }
              });
            }
            
            await this.plugin.saveSettings();
            this.plugin.updateCalendarColors(); // Update colors visually without fetching
            this.display(); // Refresh settings display to show/hide color pickers
          })
      );
  }

  private renderRefreshInterval(): void {
    new Setting(this.containerEl)
      .setName("Refresh interval")
      .setDesc("How often to refresh calendar data (in minutes)")
      .addText((text) =>
        text
          .setValue(String(this.plugin.settings.refreshInterval))
          .onChange(async (value) => {
            const interval = parseInt(value);
            if (!isNaN(interval) && interval > 0) {
              this.plugin.settings.refreshInterval = interval;
              await this.plugin.saveSettings();
            }
          })
      );
  }

  private renderNoteLocation(): void {
    const locationSetting = new Setting(this.containerEl)
      .setName("Note location")
      .setDesc("Where to save new event notes");

    locationSetting.settingEl.addClass("memochron-setting-item-container");

    const locationInput = new TextComponent(locationSetting.controlEl);
    locationInput
      .setPlaceholder("calendar-notes/")
      .setValue(this.plugin.settings.noteLocation);

    const suggestionContainer = locationSetting.controlEl.createDiv({
      cls: "memochron-suggestion-container",
    });
    suggestionContainer.classList.remove("is-visible");

    this.setupPathSuggestions(
      locationInput,
      suggestionContainer,
      async () => await this.plugin.noteService.getAllFolders(),
      async (value) => {
        this.plugin.settings.noteLocation = value;
        await this.plugin.saveSettings();
      }
    );
  }

  private renderNoteTitleFormat(): void {
    new Setting(this.containerEl)
      .setName("Note title format")
      .setDesc(
        "Format for new note titles. Available variables: {{event_title}}, {{date}}, {{source}}"
      )
      .addText((text) =>
        text
          .setPlaceholder("{{event_title}} - {{date}}")
          .setValue(this.plugin.settings.noteTitleFormat)
          .onChange(async (value) => {
            this.plugin.settings.noteTitleFormat = value;
            await this.plugin.saveSettings();
          })
      );
  }

  private renderNoteDateFormat(): void {
    const dateFormats = [
      { value: "ISO", label: "ISO (YYYY-MM-DD)" },
      { value: "US", label: "US (MM/DD/YYYY)" },
      { value: "UK", label: "UK (DD/MM/YYYY)" },
      { value: "Long", label: "Long (Month DD, YYYY)" },
    ];

    new Setting(this.containerEl)
      .setName("Note date format")
      .setDesc("Choose how dates appear in event notes")
      .addDropdown((dropdown) => {
        dateFormats.forEach(({ value, label }) => {
          dropdown.addOption(value, label);
        });
        
        dropdown
          .setValue(this.plugin.settings.noteDateFormat)
          .onChange(async (value) => {
            this.plugin.settings.noteDateFormat = value;
            await this.plugin.saveSettings();
          });
      });
  }

  private renderDefaultFrontmatter(): void {
    new Setting(this.containerEl)
      .setName("Default frontmatter")
      .setDesc("YAML frontmatter to add at the top of each event note")
      .addTextArea((text) => {
        text
          .setPlaceholder("---\ntype: event\ndate: {{date}}\n---")
          .setValue(this.plugin.settings.defaultFrontmatter)
          .onChange(async (value) => {
            this.plugin.settings.defaultFrontmatter = value;
            await this.plugin.saveSettings();
          });
        text.inputEl.rows = 4;
        text.inputEl.cols = 50;
      });
  }

  private renderNoteTemplate(): void {
    new Setting(this.containerEl)
      .setName("Note template")
      .setDesc(
        "Template for the note content. Available variables: {{event_title}}, {{date}}, {{start_time}}, {{end_time}}, {{source}}, {{location}}, {{description}}"
      )
      .addTextArea((text) => {
        text
          .setValue(this.plugin.settings.noteTemplate)
          .onChange(async (value) => {
            this.plugin.settings.noteTemplate = value;
            await this.plugin.saveSettings();
          });
        text.inputEl.rows = 10;
        text.inputEl.cols = 50;
      });
  }

  private renderFolderPathTemplate(): void {
    const templateSetting = new Setting(this.containerEl)
      .setName("Folder path template")
      .setDesc("Organize notes in date-based subfolders. Leave empty to save all notes in the same folder.");

    templateSetting.descEl.createEl("br");
    templateSetting.descEl.createEl("small", {
      text: "Available variables: {YYYY}, {YY}, {MM}, {M}, {MMM}, {MMMM}, {DD}, {D}, {DDD}, {DDDD}, {Q}, {source}, {event_title}"
    });
    templateSetting.descEl.createEl("br");
    templateSetting.descEl.createEl("small", {
      text: "Examples: {YYYY}/{MM}, {YYYY}-{MMM}, {source}/{YYYY}/{MMM}"
    });

    templateSetting.addText((text) =>
      text
        .setPlaceholder("{YYYY}/{MMM}")
        .setValue(this.plugin.settings.folderPathTemplate)
        .onChange(async (value) => {
          this.plugin.settings.folderPathTemplate = value;
          await this.plugin.saveSettings();
        })
    );

    // Add preview container
    const previewContainer = templateSetting.controlEl.createDiv({
      cls: "memochron-template-preview",
    });
    this.updateTemplatePreview(previewContainer, this.plugin.settings.folderPathTemplate);

    // Update preview when input changes
    const textInput = templateSetting.controlEl.querySelector('input') as HTMLInputElement;
    if (textInput) {
      textInput.addEventListener('input', () => {
        this.updateTemplatePreview(previewContainer, textInput.value);
      });
    }
  }

  private updateTemplatePreview(container: HTMLElement, template: string): void {
    container.empty();
    
    if (!template.trim()) {
      container.createEl("small", {
        text: "Preview: Notes will be saved directly in the note location folder",
        cls: "memochron-preview-text"
      });
      return;
    }

    // Create a sample date for preview
    const sampleDate = new Date();
    const sampleEvent = {
      title: "Sample Meeting",
      start: sampleDate,
      end: sampleDate,
      source: "Work Calendar"
    };

    try {
      const previewPath = this.generatePreviewPath(template, sampleEvent);
      container.createEl("small", {
        text: `Preview: ${previewPath}/`,
        cls: "memochron-preview-text"
      });
    } catch (error) {
      container.createEl("small", {
        text: "Invalid template format",
        cls: "memochron-preview-error"
      });
    }
  }

  private generatePreviewPath(template: string, event: any): string {
    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];
    const monthAbbreviations = [
      "Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
    ];
    const dayNames = [
      "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"
    ];
    const dayAbbreviations = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    const date = event.start;
    const year = date.getFullYear();
    const month = date.getMonth();
    const day = date.getDate();
    const dayOfWeek = date.getDay();
    const quarter = Math.floor(month / 3) + 1;

    const variables = {
      YYYY: year.toString(),
      YY: year.toString().slice(-2),
      MM: (month + 1).toString().padStart(2, "0"),
      M: (month + 1).toString(),
      MMM: monthAbbreviations[month],
      MMMM: monthNames[month],
      DD: day.toString().padStart(2, "0"),
      D: day.toString(),
      DDD: dayAbbreviations[dayOfWeek],
      DDDD: dayNames[dayOfWeek],
      Q: quarter.toString(),
      source: event.source.replace(/[\\/:*?"<>|]/g, "-"),
      event_title: event.title.replace(/[\\/:*?"<>|]/g, "-"),
    };

    return Object.entries(variables).reduce((result, [key, value]) => {
      const pattern = new RegExp(`\\{${key}\\}`, "g");
      return result.replace(pattern, value);
    }, template);
  }

  private renderDefaultTags(): void {
    new Setting(this.containerEl)
      .setName("Default tags")
      .setDesc("Default tags for all event notes (comma-separated)")
      .addText((text) =>
        text
          .setPlaceholder("event, meeting")
          .setValue(this.plugin.settings.defaultTags.join(", "))
          .onChange(async (value) => {
            this.plugin.settings.defaultTags = this.parseTags(value);
            await this.plugin.saveSettings();
          })
      );
  }

  private parseTags(value: string): string[] {
    return value
      .split(",")
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0);
  }

  private setupPathSuggestions(
    input: TextComponent,
    suggestionContainer: HTMLElement,
    getSuggestions: () => Promise<string[]>,
    onSelect: (value: string) => Promise<void>
  ): void {
    const showSuggestions = async () => {
      const suggestions = await getSuggestions();
      this.displaySuggestions(
        input,
        suggestionContainer,
        suggestions,
        input.getValue(),
        onSelect
      );
    };

    input.inputEl.addEventListener("focus", showSuggestions);
    input.inputEl.addEventListener("input", showSuggestions);
    
    input.inputEl.addEventListener("blur", () => {
      setTimeout(() => {
        // Check if container still exists before manipulating
        if (suggestionContainer && suggestionContainer.parentNode) {
          suggestionContainer.classList.remove("is-visible");
        }
      }, 200);
    });
  }

  private displaySuggestions(
    input: TextComponent,
    container: HTMLElement,
    allSuggestions: string[],
    query: string,
    onSelect: (value: string) => Promise<void>
  ): void {
    container.empty();

    const matchingSuggestions = allSuggestions.filter((s) =>
      s.toLowerCase().includes(query.toLowerCase())
    );

    if (matchingSuggestions.length === 0) {
      container.classList.remove("is-visible");
      return;
    }

    container.classList.add("is-visible");
    const ul = container.createEl("ul", { cls: "memochron-suggestion-list" });

    matchingSuggestions.slice(0, 5).forEach((suggestion) => {
      const li = ul.createEl("li", { text: suggestion });
      li.addEventListener("mousedown", async (e) => {
        e.preventDefault();
        input.setValue(suggestion);
        await onSelect(suggestion);
        container.classList.remove("is-visible");
      });
    });
  }
}

// Simple file picker modal for ICS files
class FilePickerModal extends SuggestModal<TFile> {
  constructor(
    app: App,
    private files: TFile[],
    private onChoose: (file: TFile) => void
  ) {
    super(app);
  }

  getSuggestions(query: string): TFile[] {
    return this.files.filter(file =>
      file.path.toLowerCase().includes(query.toLowerCase())
    );
  }

  renderSuggestion(file: TFile, el: HTMLElement) {
    el.createEl("div", { text: file.path });
    el.createEl("small", { 
      text: `Modified: ${new Date(file.stat.mtime).toLocaleDateString()}`,
      cls: "memochron-file-picker-date"
    });
  }

  onChooseSuggestion(file: TFile) {
    this.onChoose(file);
  }
}

// Color picker modal with color wheel
class ColorPickerModal extends Modal {
  private currentHue = 0;
  private currentSaturation = 70;
  private currentLightness = 50;

  constructor(
    app: App,
    private currentColor: string,
    private onChoose: (color: string) => void
  ) {
    super(app);
    this.parseCurrentColor();
  }

  private parseCurrentColor() {
    // Parse HSL color if it exists
    const hslMatch = this.currentColor.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
    if (hslMatch) {
      this.currentHue = parseInt(hslMatch[1]);
      this.currentSaturation = parseInt(hslMatch[2]);
      this.currentLightness = parseInt(hslMatch[3]);
      return;
    }

    // Parse hex color if it exists
    const hexMatch = this.currentColor.match(/^#([A-Fa-f0-9]{6})$/);
    if (hexMatch) {
      const [h, s, l] = this.hexToHsl(hexMatch[1]);
      this.currentHue = h;
      this.currentSaturation = s;
      this.currentLightness = l;
    }
  }

  private hexToHsl(hex: string): [number, number, number] {
    const r = parseInt(hex.substr(0, 2), 16) / 255;
    const g = parseInt(hex.substr(2, 2), 16) / 255;
    const b = parseInt(hex.substr(4, 2), 16) / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0, s = 0, l = (max + min) / 2;

    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }

    return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
  }

  private hslToHex(h: number, s: number, l: number): string {
    h /= 360;
    s /= 100;
    l /= 100;

    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    
    const r = Math.round(hue2rgb(p, q, h + 1/3) * 255);
    const g = Math.round(hue2rgb(p, q, h) * 255);
    const b = Math.round(hue2rgb(p, q, h - 1/3) * 255);

    return "#" + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();

    contentEl.createEl("h3", { text: "Choose Calendar Color" });

    // Color picker container
    const colorContainer = contentEl.createEl("div", { cls: "memochron-color-picker-container" });
    
    // Color spectrum area
    const spectrumContainer = colorContainer.createEl("div", { cls: "memochron-spectrum-container" });
    
    // Main color spectrum (hue/saturation picker)
    const spectrum = spectrumContainer.createEl("canvas", {
      cls: "memochron-color-spectrum",
      attr: { width: "300", height: "200" }
    }) as HTMLCanvasElement;
    
    // Lightness bar
    const lightnessBar = spectrumContainer.createEl("canvas", {
      cls: "memochron-lightness-bar",
      attr: { width: "300", height: "20" }
    }) as HTMLCanvasElement;
    
    // Color preview and hex input row
    const inputRow = colorContainer.createEl("div", { cls: "memochron-input-row" });
    
    // Color preview
    const preview = inputRow.createEl("div", { cls: "memochron-color-preview-small" });
    
    // Hex input
    const hexInput = inputRow.createEl("input", {
      type: "text",
      cls: "memochron-hex-input",
      attr: {
        placeholder: "#ff0000",
        maxlength: "7"
      }
    }) as HTMLInputElement;
    
    // Preset colors
    const presetsContainer = colorContainer.createEl("div", { cls: "memochron-color-presets" });
    presetsContainer.createEl("div", { text: "Quick colors:", cls: "memochron-presets-label" });
    const presetColors = [
      "#e74c3c", "#e67e22", "#f1c40f", "#2ecc71", 
      "#3498db", "#9b59b6", "#34495e", "#95a5a6"
    ];
    
    const presetsGrid = presetsContainer.createEl("div", { cls: "memochron-presets-grid" });
    presetColors.forEach(color => {
      const preset = presetsGrid.createEl("div", {
        cls: "memochron-color-preset",
        attr: { "data-color": color }
      });
      preset.style.backgroundColor = color;
      preset.addEventListener("click", () => {
        hexInput.value = color;
        updateFromHex();
      });
    });
    
    // Initialize canvases
    const spectrumCtx = spectrum.getContext("2d")!;
    const lightnessCtx = lightnessBar.getContext("2d")!;
    
    // Draw color spectrum
    const drawSpectrum = () => {
      const width = spectrum.width;
      const height = spectrum.height;
      
      // Create gradient
      for (let x = 0; x < width; x++) {
        const hue = (x / width) * 360;
        const gradient = spectrumCtx.createLinearGradient(0, 0, 0, height);
        gradient.addColorStop(0, `hsl(${hue}, 100%, 50%)`);
        gradient.addColorStop(1, `hsl(${hue}, 0%, 50%)`);
        spectrumCtx.fillStyle = gradient;
        spectrumCtx.fillRect(x, 0, 1, height);
      }
    };
    
    // Draw lightness bar
    const drawLightnessBar = () => {
      const width = lightnessBar.width;
      const gradient = lightnessCtx.createLinearGradient(0, 0, width, 0);
      gradient.addColorStop(0, `hsl(${this.currentHue}, ${this.currentSaturation}%, 0%)`);
      gradient.addColorStop(0.5, `hsl(${this.currentHue}, ${this.currentSaturation}%, 50%)`);
      gradient.addColorStop(1, `hsl(${this.currentHue}, ${this.currentSaturation}%, 100%)`);
      lightnessCtx.fillStyle = gradient;
      lightnessCtx.fillRect(0, 0, width, 20);
    };
    
    // Update color display
    const updateColor = () => {
      const color = `hsl(${this.currentHue}, ${this.currentSaturation}%, ${this.currentLightness}%)`;
      preview.style.backgroundColor = color;
      hexInput.value = this.hslToHex(this.currentHue, this.currentSaturation, this.currentLightness);
      drawLightnessBar();
    };
    
    // Handle spectrum click
    spectrum.addEventListener("click", (e) => {
      const rect = spectrum.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      this.currentHue = Math.round((x / spectrum.width) * 360);
      this.currentSaturation = Math.round((1 - y / spectrum.height) * 100);
      updateColor();
    });
    
    // Handle lightness bar click
    lightnessBar.addEventListener("click", (e) => {
      const rect = lightnessBar.getBoundingClientRect();
      const x = e.clientX - rect.left;
      this.currentLightness = Math.round((x / lightnessBar.width) * 100);
      updateColor();
    });
    
    // Hex input handler
    const updateFromHex = () => {
      const hexValue = hexInput.value.trim();
      const hexMatch = hexValue.match(/^#?([A-Fa-f0-9]{6})$/);
      
      if (hexMatch) {
        const hex = hexMatch[1];
        const [h, s, l] = this.hexToHsl(hex);
        this.currentHue = h;
        this.currentSaturation = s;
        this.currentLightness = l;
        updateColor();
      }
    };

    hexInput.addEventListener("input", updateFromHex);
    hexInput.addEventListener("blur", updateFromHex);
    
    // Initial draw
    drawSpectrum();
    updateColor();

    // Buttons
    const buttonContainer = contentEl.createEl("div", { cls: "memochron-color-buttons" });
    
    const confirmButton = buttonContainer.createEl("button", {
      text: "Choose Color",
      cls: "mod-cta"
    });
    
    const cancelButton = buttonContainer.createEl("button", {
      text: "Cancel"
    });

    confirmButton.addEventListener("click", () => {
      // Use hex if user entered it, otherwise use HSL
      const hexValue = hexInput.value.trim();
      const isValidHex = /^#?([A-Fa-f0-9]{6})$/.test(hexValue);
      
      const finalColor = isValidHex 
        ? (hexValue.startsWith('#') ? hexValue : '#' + hexValue)
        : `hsl(${this.currentHue}, ${this.currentSaturation}%, ${this.currentLightness}%)`;
        
      this.onChoose(finalColor);
      this.close();
    });

    cancelButton.addEventListener("click", () => {
      this.close();
    });
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}