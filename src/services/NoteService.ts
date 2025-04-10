import {
  App,
  TFile,
  normalizePath,
  TFolder,
  TAbstractFile,
  getAllTags,
} from "obsidian";
import { CalendarEvent } from "./CalendarService";
import { MemoChronSettings } from "../settings/types";

export class NoteService {
  constructor(private app: App, private settings: MemoChronSettings) {}

  async createEventNote(event: CalendarEvent): Promise<TFile> {
    const { vault } = this.app;
    const { templatePath, noteLocation, noteTitleFormat } = this.settings;

    // Clean up note location path
    const normalizedLocation = normalizePath(noteLocation);

    // Generate the file name and full path
    const fileName = this.formatTitle(noteTitleFormat, event);
    const fullPath = normalizePath(`${normalizedLocation}/${fileName}.md`);

    const template = await this.getTemplate(templatePath);
    const noteContent = this.populateTemplate(template, event);

    try {
      // Ensure folder exists before creating note
      if (normalizedLocation !== "/") {
        await this.ensureFolderExists(normalizedLocation);
      }

      let file = vault.getAbstractFileByPath(fullPath);
      if (file instanceof TFile) {
        await vault.modify(file, noteContent);
        return file;
      } else {
        return await vault.create(fullPath, noteContent);
      }
    } catch (error) {
      console.error("Error creating note:", error);
      throw error;
    }
  }

  async getAllTemplatePaths(): Promise<string[]> {
    const files = this.app.vault.getFiles();
    return files
      .filter((file) => file.extension === "md")
      .map((file) => file.path);
  }

  async getAllFolders(): Promise<string[]> {
    const folders = new Set<string>(["/"]);

    const processFolder = (folder: TFolder) => {
      folders.add(folder.path);
      folder.children.forEach((child) => {
        if (child instanceof TFolder) {
          processFolder(child);
        }
      });
    };

    this.app.vault.getAllLoadedFiles().forEach((file) => {
      if (file instanceof TFolder) {
        processFolder(file);
      }
    });

    // Convert Set to array and sort for consistent ordering
    return Array.from(folders).sort((a, b) => a.localeCompare(b));
  }

  private async getTemplate(templatePath: string): Promise<string> {
    if (!templatePath) {
      return this.getDefaultTemplate();
    }

    const { vault } = this.app;
    const templateFile = vault.getAbstractFileByPath(templatePath);

    if (templateFile instanceof TFile) {
      return await vault.read(templateFile);
    }

    return this.getDefaultTemplate();
  }

  private cleanTeamsDescription(description: string): string {
    if (!description) return "";

    // Check if it's a Teams meeting description
    if (
      description.includes("Microsoft Teams meeting") ||
      description.includes(
        "________________________________________________________________________________"
      )
    ) {
      let cleanedDesc = "";

      // Extract Teams meeting link
      const joinLinkMatch = description.match(
        /https:\/\/teams\.microsoft\.com\/l\/meetup-join\/[^\s\n]*/
      );
      if (joinLinkMatch) {
        cleanedDesc += `[Join the meeting now](${joinLinkMatch[0]})\n\n`;
      }

      // Extract meeting ID if present (common format: Meeting ID: 123 456 789)
      const meetingIdMatch = description.match(/Meeting ID:?\s*(\d[\d\s]+)/i);
      if (meetingIdMatch) {
        cleanedDesc += `Meeting ID: ${meetingIdMatch[1].trim()}\n`;
      }

      // Extract passcode if present (various formats)
      const passcodeMatch = description.match(
        /(?:Passcode|Password|Security code):?\s*([^\s\n]+)/i
      );
      if (passcodeMatch) {
        cleanedDesc += `Passcode: ${passcodeMatch[1].trim()}\n`;
      }

      // Extract dial-in numbers (only take the first one for brevity)
      const dialInMatch = description.match(/(?:\+\d{1,}[\d\s\-()]+)(?=\n|$)/);
      if (dialInMatch) {
        cleanedDesc += `\nDial in: ${dialInMatch[0].trim()}`;
      }

      // If we found any content, return it, otherwise return original cleaned description
      if (cleanedDesc) {
        return cleanedDesc.trim();
      }
    }

    return description;
  }

  private getDefaultTemplate(): string {
    const frontmatter =
      this.settings.defaultFrontmatter ||
      "---\ntype: event\nstatus: scheduled\n---";

    return [
      frontmatter,
      "# {{title}}",
      "",
      "## Event Details",
      this.settings.eventDetailsTemplate ||
        "- Date: {{date}}\n- Time: {{startTime}} - {{endTime}}\n- Calendar: {{source}}\n{{#if location}}- Location: {{location}}{{/if}}",
      "",
      "## Description",
      "{{description}}",
      "",
      "## Notes",
      "",
    ].join("\n");
  }

  private getTagsForEvent(event: CalendarEvent): string[] {
    // Start with default tags
    const tags = [...(this.settings.defaultTags || [])];

    // Add calendar-specific tags if they exist
    const calendarSource = this.settings.calendarUrls.find(
      (cal) => cal.name === event.source
    );
    if (calendarSource?.tags) {
      tags.push(...calendarSource.tags);
    }

    // Remove duplicates and return
    return [...new Set(tags)];
  }

  private formatTitle(format: string, event: CalendarEvent): string {
    const date = event.start.toISOString().split("T")[0];
    return format
      .replace(/{{event_title}}/g, this.sanitizeFileName(event.title))
      .replace(/{{date}}/g, date)
      .replace(/{{source}}/g, this.sanitizeFileName(event.source));
  }

  private formatDate(date: Date): string {
    switch (this.settings.noteDateFormat) {
      case "ISO":
        return date.toISOString().split("T")[0]; // YYYY-MM-DD
      case "US":
        return date.toLocaleDateString("en-US", {
          month: "2-digit",
          day: "2-digit",
          year: "numeric",
        });
      case "UK":
        return date.toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        });
      case "Long":
        return date.toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
        });
      default:
        return date.toISOString().split("T")[0];
    }
  }

  private populateTemplate(template: string, event: CalendarEvent): string {
    const dateStr = this.formatDate(event.start);
    const startTime = event.start.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
    const endTime = event.end.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
    const cleanedDescription = this.cleanTeamsDescription(
      event.description || ""
    );
    const tags = this.getTagsForEvent(event);

    // Format tags in YAML style with each tag on a new line
    const tagsYaml = tags.length > 0
      ? "tags:\n" + tags.map(tag => `  - ${tag}`).join("\n")
      : "";

    let content = template
      .replace(/{{title}}/g, event.title)
      .replace(/{{date}}/g, dateStr)
      .replace(/{{startTime}}/g, startTime)
      .replace(/{{endTime}}/g, endTime)
      .replace(/{{description}}/g, cleanedDescription)
      .replace(/{{location}}/g, event.location || "")
      .replace(/{{source}}/g, event.source)
      .replace(/{{#if location}}(.*?){{\/if}}/g, (_, content) =>
        event.location ? content : ""
      );

    // Insert tags into frontmatter before the closing marker
    if (tags.length > 0) {
      const frontmatterEnd = content.indexOf("---", 4);
      if (frontmatterEnd !== -1) {
        content =
          content.slice(0, frontmatterEnd) +
          "\n" + tagsYaml + "\n" +
          content.slice(frontmatterEnd);
      }
    }

    return content;
  }

  private async ensureFolderExists(path: string): Promise<void> {
    const { vault } = this.app;

    // Split the path into folder segments and filter out empty ones
    const folders = path.split("/").filter((p) => p.length);

    // Build the path incrementally
    let currentPath = "";
    for (const folder of folders) {
      currentPath = currentPath ? `${currentPath}/${folder}` : folder;

      // Check if folder exists
      const existing = vault.getAbstractFileByPath(currentPath);
      if (!existing) {
        try {
          await vault.createFolder(currentPath);
        } catch (error) {
          // If folder already exists (race condition), continue
          if (!error.message.includes("already exists")) {
            throw error;
          }
        }
      } else if (!(existing instanceof TFolder)) {
        // Path exists but is not a folder
        throw new Error(
          `Cannot create folder '${currentPath}' because a file with that name already exists`
        );
      }
    }
  }

  private sanitizeFileName(str: string): string {
    return str.replace(/[\\/:*?"<>|]/g, "-");
  }
}
