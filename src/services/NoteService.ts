import { App, TFile, TFolder, normalizePath } from "obsidian";
import { MemoChronSettings } from "../settings/types";
import { CalendarEvent } from "./CalendarService";

interface EventTemplateVariables {
  event_title: string;
  date: string;
  "date-iso": string;
  start_time: string;
  end_time: string;
  source: string;
  location: string;
  locationText: string;
  description: string;
}

export class NoteService {
  private static readonly NOTES_SECTION_MARKER = "## 📝 Notes";
  private static readonly FRONTMATTER_DELIMITER = "---";
  private static readonly TEAMS_SEPARATOR = "________________";
  
  private static readonly LOCATION_EMOJIS = {
    URL: "🔗",
    VIRTUAL: "💻",
    PHYSICAL: "📍",
  };

  constructor(
    private app: App, 
    private settings: MemoChronSettings
  ) {}

  async createEventNote(event: CalendarEvent): Promise<TFile> {
    const filePath = this.buildFilePath(event);

    try {
      await this.ensureParentFolder(filePath);
      
      const existingFile = this.app.vault.getAbstractFileByPath(filePath);
      if (existingFile instanceof TFile) {
        await this.updateExistingNote(existingFile, event);
        return existingFile;
      }

      const content = this.generateNoteContent(event);
      return await this.app.vault.create(filePath, content);
    } catch (error) {
      console.error("Error creating note:", error);
      throw error;
    }
  }

  async getAllFolders(): Promise<string[]> {
    const folders = new Set<string>(["/"]);

    this.app.vault.getAllLoadedFiles().forEach((file) => {
      if (file instanceof TFolder) {
        this.collectFolderPaths(file, folders);
      }
    });

    return Array.from(folders).sort((a, b) => a.localeCompare(b));
  }

  private buildFilePath(event: CalendarEvent): string {
    const { noteLocation, noteTitleFormat } = this.settings;
    const normalizedPath = normalizePath(noteLocation);
    const title = this.formatTitle(noteTitleFormat, event);
    return normalizePath(`${normalizedPath}/${title}.md`);
  }

  private async ensureParentFolder(filePath: string): Promise<void> {
    const parentPath = filePath.substring(0, filePath.lastIndexOf("/"));
    if (parentPath && parentPath !== "/") {
      await this.ensureFolderExists(parentPath);
    }
  }

  private collectFolderPaths(folder: TFolder, folders: Set<string>): void {
    folders.add(folder.path);
    folder.children.forEach((child) => {
      if (child instanceof TFolder) {
        this.collectFolderPaths(child, folders);
      }
    });
  }

  private async updateExistingNote(
    file: TFile,
    event: CalendarEvent
  ): Promise<void> {
    const existingContent = await this.app.vault.read(file);
    const preservedNotes = this.extractNotesSection(existingContent);
    const newContent = this.generateNoteContent(event);
    const updatedContent = this.mergeContentWithNotes(newContent, preservedNotes);
    
    await this.app.vault.modify(file, updatedContent);
  }

  private extractNotesSection(content: string): string {
    const notesIndex = content.indexOf(NoteService.NOTES_SECTION_MARKER);
    if (notesIndex === -1) return "";
    
    return content
      .slice(notesIndex + NoteService.NOTES_SECTION_MARKER.length)
      .trim();
  }

  private mergeContentWithNotes(newContent: string, preservedNotes: string): string {
    const notesIndex = newContent.indexOf(NoteService.NOTES_SECTION_MARKER);
    if (notesIndex === -1) return newContent;
    
    const baseContent = newContent.slice(0, notesIndex + NoteService.NOTES_SECTION_MARKER.length);
    return baseContent + "\n" + (preservedNotes ? "\n" + preservedNotes : "");
  }

  private generateNoteContent(event: CalendarEvent): string {
    const variables = this.getEventTemplateVariables(event);
    const frontmatter = this.generateFrontmatter(event, variables);
    const content = this.applyTemplateVariables(this.settings.noteTemplate, variables);
    
    return `${frontmatter}\n${content}`;
  }

  private generateFrontmatter(event: CalendarEvent, variables: EventTemplateVariables): string {
    let frontmatterContent = this.cleanFrontmatter(this.settings.defaultFrontmatter);
    frontmatterContent = this.applyTemplateVariables(frontmatterContent, variables);
    
    const tags = this.getTagsForEvent(event);
    if (tags.length > 0) {
      const tagsYaml = this.formatTagsYaml(tags);
      if (frontmatterContent) {
        frontmatterContent += "\n";
      }
      frontmatterContent += tagsYaml;
    }
    
    return `${NoteService.FRONTMATTER_DELIMITER}\n${frontmatterContent}\n${NoteService.FRONTMATTER_DELIMITER}`;
  }

  private cleanFrontmatter(frontmatter: string): string {
    let cleaned = frontmatter.trim();
    
    if (cleaned.startsWith(NoteService.FRONTMATTER_DELIMITER)) {
      cleaned = cleaned.substring(3);
    }
    if (cleaned.endsWith(NoteService.FRONTMATTER_DELIMITER)) {
      cleaned = cleaned.substring(0, cleaned.length - 3);
    }
    
    return cleaned.trim();
  }

  private formatTagsYaml(tags: string[]): string {
    return "tags:\n" + tags.map((tag) => `  - ${tag}`).join("\n");
  }

  private getEventTemplateVariables(event: CalendarEvent): EventTemplateVariables {
    const dateStr = this.formatDate(event.start);
    const dateIsoStr = event.start.toISOString().split("T")[0];
    const timeOptions = { hour: "2-digit", minute: "2-digit" } as const;
    
    return {
      event_title: event.title,
      date: dateStr,
      "date-iso": dateIsoStr,
      start_time: event.start.toLocaleTimeString([], timeOptions),
      end_time: event.end.toLocaleTimeString([], timeOptions),
      source: event.source,
      location: event.location || "",
      locationText: this.formatLocationText(event.location),
      description: this.cleanDescription(event.description || ""),
    };
  }

  private applyTemplateVariables(
    template: string,
    variables: EventTemplateVariables
  ): string {
    return Object.entries(variables).reduce(
      (result, [key, value]) => 
        result.replace(new RegExp(`{{${key}}}`, "g"), value),
      template
    );
  }

  private formatTitle(format: string, event: CalendarEvent): string {
    const variables = this.getEventTemplateVariables(event);
    const allowedKeys: (keyof EventTemplateVariables)[] = [
      "event_title",
      "date",
      "date-iso",
      "start_time",
      "end_time",
      "source",
      "location",
    ];

    return allowedKeys.reduce((title, key) => {
      const placeholder = `{{${key}}}`;
      const value = variables[key];
      return title.replace(
        new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"),
        this.sanitizeFileName(value)
      );
    }, format);
  }

  private formatLocationText(location?: string): string {
    if (!location) return "";
    
    const emoji = this.getLocationEmoji(location);
    return `${emoji} ${location}`;
  }

  private getLocationEmoji(location: string): string {
    if (this.isUrl(location)) {
      return NoteService.LOCATION_EMOJIS.URL;
    }
    if (this.isVirtualMeeting(location)) {
      return NoteService.LOCATION_EMOJIS.VIRTUAL;
    }
    return NoteService.LOCATION_EMOJIS.PHYSICAL;
  }

  private isUrl(location: string): boolean {
    return /^(https?:\/\/|www\.)/.test(location);
  }

  private isVirtualMeeting(location: string): boolean {
    const virtualKeywords = ["zoom", "meet.", "teams", "webex"];
    const lowerLocation = location.toLowerCase();
    return virtualKeywords.some(keyword => lowerLocation.includes(keyword));
  }

  private formatDate(date: Date): string {
    const formatters: Record<string, () => string> = {
      ISO: () => date.toISOString().split("T")[0],
      US: () => date.toLocaleDateString("en-US", {
        month: "2-digit",
        day: "2-digit",
        year: "numeric",
      }),
      UK: () => date.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }),
      Long: () => date.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      }),
    };

    const formatter = formatters[this.settings.noteDateFormat];
    return formatter ? formatter() : formatters.ISO();
  }

  private cleanDescription(description: string): string {
    const teamsIndex = description.indexOf(NoteService.TEAMS_SEPARATOR);
    return teamsIndex !== -1 
      ? description.substring(0, teamsIndex).trim()
      : description.trim();
  }

  private getTagsForEvent(event: CalendarEvent): string[] {
    const defaultTags = this.settings.defaultTags || [];
    const source = this.settings.calendarUrls.find(s => s.name === event.source);
    const sourceTags = source?.tags || [];
    
    return [...new Set([...defaultTags, ...sourceTags])];
  }

  private async ensureFolderExists(path: string): Promise<void> {
    const folders = path.split("/").filter(Boolean);
    let currentPath = "";

    for (const folder of folders) {
      currentPath = currentPath ? `${currentPath}/${folder}` : folder;
      const existing = this.app.vault.getAbstractFileByPath(currentPath);

      if (existing && !(existing instanceof TFolder)) {
        throw new Error(
          `Cannot create folder '${currentPath}' because a file with that name already exists`
        );
      }

      if (!existing) {
        try {
          await this.app.vault.createFolder(currentPath);
        } catch (error: any) {
          if (!error.message?.includes("already exists")) {
            throw error;
          }
        }
      }
    }
  }

  private sanitizeFileName(str: string): string {
    return str.replace(/[\\/:*?"<>|]/g, "-");
  }
}