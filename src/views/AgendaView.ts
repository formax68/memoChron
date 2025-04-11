import { CalendarEvent } from "../services/CalendarService";

export class AgendaView {
  private events: CalendarEvent[];

  constructor(events: CalendarEvent[]) {
    this.events = events;
  }

  public render(): void {
    const agendaContainer = document.createElement("div");
    agendaContainer.className = "agenda-view";

    const now = new Date();

    this.events.forEach((event) => {
      const eventElement = document.createElement("div");
      eventElement.className = "agenda-event";

      // Grey out past events
      if (event.end < now) {
        eventElement.classList.add("past-event");
      }

      eventElement.innerText = `${
        event.title
      } - ${event.start.toLocaleTimeString()}`;
      agendaContainer.appendChild(eventElement);
    });

    document.body.appendChild(agendaContainer);
  }

  public updateEvents(events: CalendarEvent[]): void {
    this.events = events;
    this.render();
  }
}
