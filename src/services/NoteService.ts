import { App, TFile, normalizePath } from "obsidian";
import { CalendarEvent } from "./CalendarService";
import { MemoChronSettings } from "../settings/types";

export class NoteService {
  constructor(private app: App, private settings: MemoChronSettings) {}

  async createEventNote(event: CalendarEvent): Promise<TFile> {
    const { vault } = this.app;
    const { templatePath, noteLocation, noteTitleFormat } = this.settings;

    // Generate note title and path
    const fileName = this.formatTitle(noteTitleFormat, event);
    const fullPath = normalizePath(`${noteLocation}/${fileName}.md`);

    // Get template content
    const template = await this.getTemplate(templatePath);

    // Replace template variables
    const noteContent = this.populateTemplate(template, event);

    // Create note
    try {
      // Create folders if they don't exist
      await this.ensureFolderExists(noteLocation);

      // Create or update note
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

    return template
      .replace(/{{title}}/g, event.title)
      .replace(/{{date}}/g, dateStr)
      .replace(/{{startTime}}/g, startTime)
      .replace(/{{endTime}}/g, endTime)
      .replace(/{{description}}/g, event.description || "")
      .replace(/{{location}}/g, event.location || "")
      .replace(/{{source}}/g, event.source)
      .replace(/{{#if location}}(.*?){{\/if}}/g, (_, content) =>
        event.location ? content : ""
      );
  }

  private async ensureFolderExists(path: string): Promise<void> {
    const { vault } = this.app;
    const folders = path.split("/").filter((p) => p.length);

    let currentPath = "";
    for (const folder of folders) {
      currentPath += "/" + folder;
      if (!vault.getAbstractFileByPath(currentPath)) {
        await vault.createFolder(currentPath);
      }
    }
  }

  private sanitizeFileName(str: string): string {
    return str.replace(/[\\/:*?"<>|]/g, "-");
  }
}
