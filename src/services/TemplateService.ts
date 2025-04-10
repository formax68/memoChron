import { CalendarEvent } from "./CalendarService";

export class TemplateService {
  constructor(private templateContent: string) {}

  populateTemplate(event: CalendarEvent): string {
    const dateStr = event.start.toLocaleDateString();
    const startTime = event.start.toLocaleTimeString();
    const endTime = event.end.toLocaleTimeString();

    return this.templateContent
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
}
