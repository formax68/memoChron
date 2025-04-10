import { App, TFile, normalizePath, TFolder, TAbstractFile, getAllTags } from "obsidian";
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
      if (normalizedLocation !== '/') {
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
      .filter(file => file.extension === 'md')
      .map(file => file.path);
  }

  async getAllFolders(): Promise<string[]> {
    const folders = new Set<string>(['/']);
    
    const processFolder = (folder: TFolder) => {
      folders.add(folder.path);
      folder.children.forEach(child => {
        if (child instanceof TFolder) {
          processFolder(child);
        }
      });
    };

    this.app.vault.getAllLoadedFiles().forEach(file => {
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
    if (description.includes("Microsoft Teams meeting") || 
        description.includes("________________________________________________________________________________")) {
      
      // Remove common Teams boilerplate
      return description
        // Remove the lines with just underscores
        .replace(/_{2,}/g, '')
        // Remove the "Click here to join" lines
        .replace(/Click here to join.*\n?/g, '')
        // Remove Microsoft Teams meeting join links
        .replace(/https:\/\/teams\.microsoft\.com\/l\/meetup-join\/.*\n?/g, '')
        // Remove the standard Teams footer
        .replace(/(?:Join with a video conferencing device|Join on your computer.*|Meeting options.*)\n?.*/gs, '')
        // Remove phone numbers and conference IDs
        .replace(/(?:\+[0-9]{1,}[\s\d]*(?:\([0-9]+\))?[\s\d]*)+/g, '')
        .replace(/Conference ID:[\s\d]+/g, '')
        // Remove empty lines at start and end
        .trim()
        // Remove multiple consecutive empty lines
        .replace(/\n{3,}/g, '\n\n');
    }
    
    return description;
  }

  private getDefaultTemplate(): string {
    return [
      "# {{title}}",
      "",
      "## Event Details",
      "- Date: {{date}}",
      "- Time: {{startTime}} - {{endTime}}",
      "- Calendar: {{source}}",
      "{{#if location}}- Location: {{location}}{{/if}}",
      "",
      "## Description",
      "{{description}}",
      "",
      "## Notes",
      "",
    ].join("\n");
  }

  private formatTitle(format: string, event: CalendarEvent): string {
    const date = event.start.toISOString().split("T")[0];
    return format
      .replace(/{{event_title}}/g, this.sanitizeFileName(event.title))
      .replace(/{{date}}/g, date)
      .replace(/{{source}}/g, this.sanitizeFileName(event.source));
  }

  private populateTemplate(template: string, event: CalendarEvent): string {
    const dateStr = event.start.toLocaleDateString();
    const startTime = event.start.toLocaleTimeString();
    const endTime = event.end.toLocaleTimeString();
    const cleanedDescription = this.cleanTeamsDescription(event.description || "");

    return template
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
  }

  private async ensureFolderExists(path: string): Promise<void> {
    const { vault } = this.app;
    
    // Split the path into folder segments and filter out empty ones
    const folders = path.split("/").filter(p => p.length);
    
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
          if (!error.message.includes('already exists')) {
            throw error;
          }
        }
      } else if (!(existing instanceof TFolder)) {
        // Path exists but is not a folder
        throw new Error(`Cannot create folder '${currentPath}' because a file with that name already exists`);
      }
    }
  }

  private sanitizeFileName(str: string): string {
    return str.replace(/[\\/:*?"<>|]/g, "-");
  }
}
