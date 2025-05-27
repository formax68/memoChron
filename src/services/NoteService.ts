import { App, TFile, TFolder, normalizePath } from "obsidian";
import { MemoChronSettings } from "../settings/types";
import { CalendarEvent } from "./CalendarService";
import { formatLocationText, sanitizeFileName } from "../utils/formatters";

export class NoteService {
  constructor(private app: App, private settings: MemoChronSettings) {}

  private async updateExistingNote(
    file: TFile,
    event: CalendarEvent
  ): Promise<void> {
    const existingContent = await this.app.vault.read(file);
    const notesSection = existingContent.indexOf("## 📝 Notes");

    if (notesSection === -1) {
      // If we can't find the Notes section, just update the whole file
      await this.app.vault.modify(file, this.generateNoteContent(event));
      return;
    }

    // Get the notes content after the Notes section
    const notesContent = existingContent
      .slice(notesSection + "## 📝 Notes".length)
      .trim();

    // Generate new content but preserve the notes
    const newContent = this.generateNoteContent(event);
    const newNotesSection = newContent.indexOf("## 📝 Notes");

    if (newNotesSection === -1) {
      // Shouldn't happen as our template always includes Notes section
      await this.app.vault.modify(file, newContent);
      return;
    }

    // Combine new content with existing notes
    const updatedContent =
      newContent.slice(0, newNotesSection + "## 📝 Notes".length) +
      "\n" +
      (notesContent ? "\n" + notesContent : "");

    await this.app.vault.modify(file, updatedContent);
  }

  async createEventNote(event: CalendarEvent): Promise<TFile> {
    const { vault } = this.app;
    const { noteLocation, noteTitleFormat } = this.settings;

    // Format the path
    const normalizedPath = normalizePath(noteLocation);
    const title = this.formatTitle(noteTitleFormat, event);
    const filePath = normalizePath(`${normalizedPath}/${title}.md`);

    try {
      // Create folder if needed
      if (normalizedPath !== "/") {
        await this.ensureFolderExists(normalizedPath);
      }

      // If file exists, update its contents keeping user's notes section
      const existingFile = vault.getAbstractFileByPath(filePath);
      if (existingFile instanceof TFile) {
        await this.updateExistingNote(existingFile, event);
        return existingFile;
      }

      // If file doesn't exist, create it with the template content
      const content = this.generateNoteContent(event);
      return await vault.create(filePath, content);
    } catch (error) {
      console.error("Error creating note:", error);
      throw error;
    }
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

    return Array.from(folders).sort((a, b) => a.localeCompare(b));
  }

  private getEventTemplateVariables(event: CalendarEvent) {
    const dateStr = this.formatDate(event.start);
    const dateIsoStr = event.start.toISOString().split("T")[0];
    const startTime = event.start.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
    const endTime = event.end.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
    const location = event.location || "";
    const locationText = formatLocationText(event.location);
    const cleanedDescription = this.cleanTeamsDescription(
      event.description || ""
    );

    return {
      event_title: event.title,
      date: dateStr,
      "date-iso": dateIsoStr,
      start_time: startTime,
      end_time: endTime,
      source: event.source,
      location: location, // Raw location for title
      locationText: locationText, // Formatted location for content
      description: cleanedDescription,
    };
  }

  private applyTemplateVariables(
    template: string,
    variables: Record<string, string>
  ): string {
    return template
      .replace(/{{event_title}}/g, variables.event_title)
      .replace(/{{date}}/g, variables.date)
      .replace(/{{date-iso}}/g, variables["date-iso"])
      .replace(/{{start_time}}/g, variables.start_time)
      .replace(/{{end_time}}/g, variables.end_time)
      .replace(/{{source}}/g, variables.source)
      .replace(/{{location}}/g, variables.locationText)
      .replace(/{{description}}/g, variables.description);
  }

  private generateNoteContent(event: CalendarEvent): string {
    const variables = this.getEventTemplateVariables(event);
    const tags = this.getTagsForEvent(event);

    // Prepare tags YAML
    const tagsYaml =
      tags.length > 0
        ? "tags:\n" + tags.map((tag) => `  - ${tag}`).join("\n")
        : "";

    // Base frontmatter from settings
    let frontmatterContent = this.settings.defaultFrontmatter.trim();

    if (frontmatterContent.startsWith("---")) {
      frontmatterContent = frontmatterContent.substring(3);
    }
    if (frontmatterContent.endsWith("---")) {
      frontmatterContent = frontmatterContent.substring(
        0,
        frontmatterContent.length - 3
      );
    }
    frontmatterContent = frontmatterContent.trim();

    frontmatterContent = this.applyTemplateVariables(
      frontmatterContent,
      variables
    );

    if (tagsYaml) {
      if (frontmatterContent.length > 0) {
        frontmatterContent += "\n";
      }
      frontmatterContent += tagsYaml;
    }

    const frontmatter = `---\n${frontmatterContent}\n---`;

    const content = this.applyTemplateVariables(
      this.settings.noteTemplate,
      variables
    );

    return frontmatter + "\n" + content;
  }

  private getTagsForEvent(event: CalendarEvent): string[] {
    const tags = [...(this.settings.defaultTags || [])];
    const source = this.settings.calendarUrls.find(
      (s) => s.name === event.source
    );
    if (source?.tags) {
      tags.push(...source.tags);
    }
    return [...new Set(tags)];
  }

  private formatTitle(format: string, event: CalendarEvent): string {
    const variables = this.getEventTemplateVariables(event);
    let title = format;

    // Define which variables can be used in the title
    const allowedTitleVariables: (keyof typeof variables)[] = [
      "event_title",
      "date",
      "source",
      "date-iso",
      "start_time",
      "end_time",
      "location", // Uses the raw 'location' variable
    ];

    for (const key of allowedTitleVariables) {
      const placeholder = `{{${key}}}`;
      // Escape special characters in placeholder for regex
      const escapedPlaceholder = placeholder.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
      );
      const value = variables[key];
      if (typeof value === "string") {
        title = title.replace(
          new RegExp(escapedPlaceholder, "g"),
          sanitizeFileName(value)
        );
      }
    }
    return title;
  }

  private formatDate(date: Date): string {
    switch (this.settings.noteDateFormat) {
      case "ISO":
        return date.toISOString().split("T")[0];
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

  private cleanTeamsDescription(description: string): string {
    // Remove Microsoft Teams meeting join info if present
    const teamsJoinIndex = description.indexOf("________________");
    if (teamsJoinIndex !== -1) {
      return description.substring(0, teamsJoinIndex).trim();
    }
    return description.trim();
  }

  private async ensureFolderExists(path: string): Promise<void> {
    const { vault } = this.app;
    const folders = path.split("/").filter((p) => p.length);
    let currentPath = "";

    for (const folder of folders) {
      currentPath = currentPath ? `${currentPath}/${folder}` : folder;
      const exists = vault.getAbstractFileByPath(currentPath);

      if (exists) {
        if (!(exists instanceof TFolder)) {
          throw new Error(
            `Cannot create folder '${currentPath}' because a file with that name already exists`
          );
        }
      } else {
        try {
          await vault.createFolder(currentPath);
        } catch (error) {
          if (!error.message.includes("already exists")) {
            throw error;
          }
        }
      }
    }
  }
}
