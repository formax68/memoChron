import { App, TFile, TFolder, normalizePath } from "obsidian";
import { MemoChronSettings } from "../settings/types";
import { CalendarEvent } from "./CalendarService";

interface EventTemplateVariables {
  event_title: string;
  date: string;
  "date-iso": string;
  start_date: string;
  "start_date-iso": string;
  end_date: string;
  "end_date-iso": string;
  start_time: string;
  end_time: string;
  source: string;
  location: string;
  locationText: string;
  description: string;
  attendees: string;
  attendees_list: string;
  attendees_links: string;
  attendees_links_list: string;
  attendees_count: string;
}

interface FolderTemplateVariables {
  YYYY: string;
  YY: string;
  MM: string;
  M: string;
  MMM: string;
  MMMM: string;
  DD: string;
  D: string;
  DDD: string;
  DDDD: string;
  Q: string;
  source: string;
  event_title: string;
  attendees_count: string;
}

export class NoteService {
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
        return existingFile;
      }

      const content = this.generateNoteContent(event);
      return await this.app.vault.create(filePath, content);
    } catch (error) {
      console.error("Error creating note:", error);
      throw error;
    }
  }

  getExistingEventNote(event: CalendarEvent): TFile | null {
    const filePath = this.buildFilePath(event);
    const existingFile = this.app.vault.getAbstractFileByPath(filePath);
    if (existingFile instanceof TFile) {
      return existingFile;
    }
    return null;
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
    const { noteLocation, noteTitleFormat, folderPathTemplate } = this.settings;
    const normalizedPath = normalizePath(noteLocation);
    const title = this.formatTitle(noteTitleFormat, event);
    
    // If folderPathTemplate is empty, use the old behavior
    if (!folderPathTemplate.trim()) {
      return normalizePath(`${normalizedPath}/${title}.md`);
    }
    
    // Apply folder template to create subfolder structure
    const subfolderPath = this.applyFolderTemplate(folderPathTemplate, event);
    return normalizePath(`${normalizedPath}/${subfolderPath}/${title}.md`);
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
    const startDateStr = this.formatDate(event.start);
    const startDateIsoStr = event.start.toISOString().split("T")[0];
    const endDateStr = this.formatDate(event.end);
    const endDateIsoStr = event.end.toISOString().split("T")[0];
    
    const attendeesList = event.attendees || [];
    const attendeeLinks = this.createAttendeeLinks(attendeesList);
    
    return {
      event_title: event.title,
      date: dateStr,
      "date-iso": dateIsoStr,
      start_date: startDateStr,
      "start_date-iso": startDateIsoStr,
      end_date: endDateStr,
      "end_date-iso": endDateIsoStr,
      start_time: this.formatTime(event.start),
      end_time: this.formatTime(event.end),
      source: event.source,
      location: event.location || "",
      locationText: this.formatLocationText(event.location),
      description: this.cleanDescription(event.description || ""),
      attendees: attendeesList.join(", "),
      attendees_list: attendeesList.map(a => `- ${a}`).join("\n"),
      attendees_links: attendeeLinks.join(", "),
      attendees_links_list: attendeeLinks.map(link => `- ${link}`).join("\n"),
      attendees_count: attendeesList.length.toString(),
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
    
    // Apply all template variables, sanitizing each value for use in filenames
    return Object.entries(variables).reduce((title, [key, value]) => {
      const placeholder = `{{${key}}}`;
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

  private formatTime(date: Date): string {
    const options: Intl.DateTimeFormatOptions = {
      hour: "2-digit",
      minute: "2-digit",
      hour12: this.settings.noteTimeFormat === '12h'
    };
    return date.toLocaleTimeString([], options);
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

  private applyFolderTemplate(template: string, event: CalendarEvent): string {
    const variables = this.getFolderTemplateVariables(event);
    return this.parseFolderTemplate(template, variables);
  }

  private getFolderTemplateVariables(event: CalendarEvent): FolderTemplateVariables {
    const date = event.start;
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

    const year = date.getFullYear();
    const month = date.getMonth();
    const day = date.getDate();
    const dayOfWeek = date.getDay();
    const quarter = Math.floor(month / 3) + 1;

    return {
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
      source: this.sanitizeFileName(event.source),
      event_title: this.sanitizeFileName(event.title),
      attendees_count: (event.attendees?.length || 0).toString(),
    };
  }

  private parseFolderTemplate(template: string, variables: FolderTemplateVariables): string {
    return Object.entries(variables).reduce((result, [key, value]) => {
      const pattern = new RegExp(`\\{${key}\\}`, "g");
      return result.replace(pattern, value);
    }, template);
  }

  private sanitizeFileName(str: string): string {
    return str.replace(/[\\/:*?"<>|]/g, "-");
  }

  private createAttendeeLinks(attendees: string[]): string[] {
    if (!this.settings.enableAttendeeLinks) {
      return attendees;
    }
    
    return attendees.map(attendee => {
      // Simply wrap the attendee name in wiki link brackets
      // Obsidian will find the note regardless of its location
      return `[[${attendee}]]`;
    });
  }
}